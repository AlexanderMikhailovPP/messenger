const express = require('express');
const router = express.Router();
const db = require('../db');

// Search users
router.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.json([]);
    }

    try {
        const result = await db.query('SELECT id, username, avatar_url FROM users WHERE username LIKE ? LIMIT 10', [`%${q}%`]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// Update user profile
router.put('/profile', async (req, res) => {
    const { userId, username, avatar_url } = req.body;

    if (!userId || !username) {
        return res.status(400).json({ error: 'User ID and username are required' });
    }

    try {
        await db.query(
            'UPDATE users SET username = ?, avatar_url = ? WHERE id = ?',
            [username, avatar_url || null, userId]
        );
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505') {
            return res.status(400).json({ error: 'Username already taken' });
        }
        console.error(err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;
