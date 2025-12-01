const express = require('express');
const router = express.Router();
const db = require('../db');

// Add reaction to a message
router.post('/:messageId/reactions', async (req, res) => {
    const { messageId } = req.params;
    const { userId, emoji } = req.body;

    try {
        await db.query(
            'INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
            [messageId, userId, emoji]
        );
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505') {
            // User already reacted with this emoji - remove it (toggle)
            try {
                await db.query(
                    'DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
                    [messageId, userId, emoji]
                );
                res.json({ success: true, removed: true });
            } catch (deleteErr) {
                console.error(deleteErr);
                res.status(500).json({ error: 'Failed to toggle reaction' });
            }
        } else {
            console.error(err);
            res.status(500).json({ error: 'Failed to add reaction' });
        }
    }
});

// Get reactions for a message
router.get('/:messageId/reactions', async (req, res) => {
    const { messageId } = req.params;

    try {
        const result = await db.query(
            'SELECT emoji, COUNT(*) as count FROM reactions WHERE message_id = ? GROUP BY emoji',
            [messageId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch reactions' });
    }
});

// Edit message
router.put('/:messageId', async (req, res) => {
    const { messageId } = req.params;
    const { content, userId } = req.body;

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
        console.error(err);
        res.status(500).json({ error: 'Failed to edit message' });
    }
});

// Delete message
router.delete('/:messageId', async (req, res) => {
    const { messageId } = req.params;
    const { userId } = req.body;

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
        console.error(err);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

module.exports = router;
