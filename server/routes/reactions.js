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
        console.log(`Fetching reactions for message ${messageId}`);
        const result = await db.query(`
            SELECT r.emoji, r.user_id, u.username
            FROM reactions r
            JOIN users u ON r.user_id = u.id
            WHERE r.message_id = ?
            ORDER BY r.id ASC
        `, [messageId]);

        console.log(`Found ${result.rows.length} reactions for message ${messageId}`);

        // Group by emoji and include user list
        const grouped = {};
        result.rows.forEach(row => {
            if (!grouped[row.emoji]) {
                grouped[row.emoji] = {
                    emoji: row.emoji,
                    count: 0,
                    users: []
                };
            }
            grouped[row.emoji].count++;
            grouped[row.emoji].users.push({
                id: row.user_id,
                username: row.username
            });
        });

        res.json(Object.values(grouped));
    } catch (err) {
        console.error(`Error fetching reactions for message ${messageId}:`, err);
        res.status(500).json({ error: 'Failed to fetch reactions', details: err.message });
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
