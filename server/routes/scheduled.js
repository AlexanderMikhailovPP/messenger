const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Create scheduled message
router.post('/', async (req, res) => {
    const { content, channelId, scheduledAt } = req.body;
    const userId = req.user.userId;

    if (!content || !channelId || !scheduledAt) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    try {
        const result = await db.query(
            `INSERT INTO scheduled_messages (content, user_id, channel_id, scheduled_at)
             VALUES (?, ?, ?, ?) RETURNING *`,
            [content, userId, channelId, scheduledDate.toISOString()]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Failed to create scheduled message:', err);
        res.status(500).json({ error: 'Failed to schedule message' });
    }
});

// Get user's scheduled messages
router.get('/', async (req, res) => {
    const userId = req.user.userId;

    try {
        const result = await db.query(`
            SELECT sm.*, c.name as channel_name, c.type as channel_type
            FROM scheduled_messages sm
            JOIN channels c ON sm.channel_id = c.id
            WHERE sm.user_id = ? AND sm.status = 'pending'
            ORDER BY sm.scheduled_at ASC
        `, [userId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Failed to fetch scheduled messages:', err);
        res.status(500).json({ error: 'Failed to fetch scheduled messages' });
    }
});

// Get scheduled messages for a channel
router.get('/channel/:channelId', async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    try {
        const result = await db.query(`
            SELECT * FROM scheduled_messages
            WHERE channel_id = ? AND user_id = ? AND status = 'pending'
            ORDER BY scheduled_at ASC
        `, [channelId, userId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Failed to fetch scheduled messages:', err);
        res.status(500).json({ error: 'Failed to fetch scheduled messages' });
    }
});

// Update scheduled message
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { content, scheduledAt } = req.body;
    const userId = req.user.userId;

    try {
        // Verify ownership
        const existing = await db.query(
            'SELECT * FROM scheduled_messages WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Scheduled message not found' });
        }

        const updates = [];
        const values = [];

        if (content) {
            updates.push('content = ?');
            values.push(content);
        }
        if (scheduledAt) {
            const scheduledDate = new Date(scheduledAt);
            if (scheduledDate <= new Date()) {
                return res.status(400).json({ error: 'Scheduled time must be in the future' });
            }
            updates.push('scheduled_at = ?');
            values.push(scheduledDate.toISOString());
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        values.push(id);
        await db.query(
            `UPDATE scheduled_messages SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Failed to update scheduled message:', err);
        res.status(500).json({ error: 'Failed to update scheduled message' });
    }
});

// Delete scheduled message
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const result = await db.query(
            'DELETE FROM scheduled_messages WHERE id = ? AND user_id = ? RETURNING id',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Scheduled message not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Failed to delete scheduled message:', err);
        res.status(500).json({ error: 'Failed to delete scheduled message' });
    }
});

// Send scheduled message immediately
router.post('/:id/send-now', async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const result = await db.query(
            'SELECT * FROM scheduled_messages WHERE id = ? AND user_id = ? AND status = ?',
            [id, userId, 'pending']
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Scheduled message not found' });
        }

        const message = result.rows[0];

        // Mark as sent
        await db.query(
            "UPDATE scheduled_messages SET status = 'sent' WHERE id = ?",
            [id]
        );

        res.json({
            success: true,
            message: {
                content: message.content,
                channelId: message.channel_id
            }
        });
    } catch (err) {
        console.error('Failed to send scheduled message:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
