const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get messages for a channel
router.get('/:channelId', async (req, res) => {
    const { channelId } = req.params;
    try {
        const result = await db.query(`
            SELECT m.*, u.username, u.avatar_url
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.channel_id = ?
            ORDER BY m.id ASC
        `, [channelId]);
        res.json(result.rows);
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.error(`Error fetching messages for channel ${channelId}:`, err);
        }
        res.status(500).json({ error: 'Failed to fetch messages' });
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
