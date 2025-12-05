const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { uploadFile, isR2Configured } = require('../storage/r2-client');

// All routes require authentication
router.use(authMiddleware);

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Upload file attachment
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        let fileUrl;
        const originalName = req.file.originalname;
        const mimeType = req.file.mimetype;
        const fileSize = req.file.size;

        if (isR2Configured()) {
            // Upload to Cloudflare R2
            fileUrl = await uploadFile(
                req.file.buffer,
                originalName,
                mimeType,
                'attachments'
            );
        } else {
            // Fallback to local filesystem
            const fs = require('fs').promises;
            const uploadDir = path.join(__dirname, '../uploads/attachments');

            // Ensure directory exists
            await fs.mkdir(uploadDir, { recursive: true });

            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(originalName);
            const filename = 'file-' + uniqueSuffix + ext;
            const filepath = path.join(uploadDir, filename);

            await fs.writeFile(filepath, req.file.buffer);
            fileUrl = `/uploads/attachments/${filename}`;
        }

        res.json({
            url: fileUrl,
            name: originalName,
            type: mimeType,
            size: fileSize
        });
    } catch (err) {
        console.error('File upload error:', err);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Upload voice message
router.post('/voice', upload.single('audio'), async (req, res) => {
    console.log('Voice upload request received');
    console.log('File:', req.file ? { size: req.file.size, mimetype: req.file.mimetype } : 'NO FILE');

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio uploaded' });
        }

        let fileUrl;
        const mimeType = req.file.mimetype || 'audio/webm';
        const fileSize = req.file.size;

        console.log('Processing voice file:', { mimeType, fileSize });

        if (isR2Configured()) {
            // Upload to Cloudflare R2
            fileUrl = await uploadFile(
                req.file.buffer,
                `voice-${Date.now()}.webm`,
                mimeType,
                'voice-messages'
            );
        } else {
            // Fallback to local filesystem
            const fs = require('fs').promises;
            const uploadDir = path.join(__dirname, '../uploads/voice');

            // Ensure directory exists
            await fs.mkdir(uploadDir, { recursive: true });

            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = 'voice-' + uniqueSuffix + '.webm';
            const filepath = path.join(uploadDir, filename);

            await fs.writeFile(filepath, req.file.buffer);
            fileUrl = `/uploads/voice/${filename}`;
            console.log('Voice file saved to:', filepath);
        }

        console.log('Voice upload success:', { url: fileUrl, size: fileSize });
        res.json({
            url: fileUrl,
            type: mimeType,
            size: fileSize
        });
    } catch (err) {
        console.error('Voice upload error:', err);
        res.status(500).json({ error: 'Failed to upload voice message' });
    }
});

// Get messages for a channel (excluding thread replies)
router.get('/:channelId', async (req, res) => {
    const { channelId } = req.params;
    try {
        const result = await db.query(`
            SELECT m.*, u.username, u.avatar_url, u.custom_status,
                   (SELECT COUNT(*) FROM messages WHERE thread_id = m.id) as reply_count,
                   (SELECT MAX(created_at) FROM messages WHERE thread_id = m.id) as last_reply_at
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.channel_id = ? AND m.thread_id IS NULL
            ORDER BY m.id ASC
        `, [channelId]);

        // For messages with threads, fetch unique participants (up to 5)
        const messagesWithParticipants = await Promise.all(result.rows.map(async (msg) => {
            if (parseInt(msg.reply_count) > 0) {
                const participantsResult = await db.query(`
                    SELECT u.id, u.username, u.avatar_url, u.custom_status
                    FROM users u
                    WHERE u.id IN (
                        SELECT DISTINCT m.user_id
                        FROM messages m
                        WHERE m.thread_id = ?
                    )
                    LIMIT 5
                `, [msg.id]);
                return { ...msg, thread_participants: participantsResult.rows };
            }
            return msg;
        }));

        res.json(messagesWithParticipants);
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.error(`Error fetching messages for channel ${channelId}:`, err);
        }
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Get thread messages (replies to a parent message)
router.get('/thread/:messageId', async (req, res) => {
    const { messageId } = req.params;
    try {
        // Get parent message
        const parentResult = await db.query(`
            SELECT m.*, u.username, u.avatar_url, u.custom_status
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.id = ?
        `, [messageId]);

        if (parentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Get thread replies
        const repliesResult = await db.query(`
            SELECT m.*, u.username, u.avatar_url, u.custom_status
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.thread_id = ?
            ORDER BY m.id ASC
        `, [messageId]);

        res.json({
            parent: parentResult.rows[0],
            replies: repliesResult.rows
        });
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.error(`Error fetching thread ${messageId}:`, err);
        }
        res.status(500).json({ error: 'Failed to fetch thread' });
    }
});

// Edit message
router.put('/:messageId', async (req, res) => {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    try {
        // Verify ownership
        const msgResult = await db.query('SELECT user_id FROM messages WHERE id = ?', [messageId]);
        if (msgResult.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        if (msgResult.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await db.query(
            'UPDATE messages SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?',
            [content, messageId]
        );
        res.json({ success: true });
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.error(err);
        }
        res.status(500).json({ error: 'Failed to edit message' });
    }
});

// Delete message
router.delete('/:messageId', async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.userId;

    try {
        // Verify ownership
        const msgResult = await db.query('SELECT user_id FROM messages WHERE id = ?', [messageId]);
        if (msgResult.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        if (msgResult.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await db.query('DELETE FROM messages WHERE id = ?', [messageId]);
        res.json({ success: true });
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.error(err);
        }
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

module.exports = router;
