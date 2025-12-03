const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Add reaction to a message
router.post('/:messageId/reactions', async (req, res) => {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.userId;

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
                if (process.env.NODE_ENV !== 'production') {
                    console.error(deleteErr);
                }
                res.status(500).json({ error: 'Failed to toggle reaction' });
            }
        } else if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || err.code === '23503') {
            res.status(404).json({ error: 'Message or user not found' });
        } else {
            if (process.env.NODE_ENV !== 'production') {
                console.error(err);
            }
            res.status(500).json({ error: 'Failed to add reaction' });
        }
    }
});

// Get reactions for a message
router.get('/:messageId/reactions', async (req, res) => {
    const { messageId } = req.params;

    try {
        const result = await db.query(`
            SELECT r.emoji, r.user_id, u.username
            FROM reactions r
            JOIN users u ON r.user_id = u.id
            WHERE r.message_id = ?
            ORDER BY r.id ASC
        `, [messageId]);

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
        if (process.env.NODE_ENV !== 'production') {
            console.error(`Error fetching reactions for message ${messageId}:`, err);
        }
        res.status(500).json({ error: 'Failed to fetch reactions' });
    }
});

module.exports = router;
