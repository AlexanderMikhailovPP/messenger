const express = require('express');
const router = express.Router();
const db = require('../db');

// Search users
router.get('/search', (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.json([]);
    }

    try {
        const stmt = db.prepare('SELECT id, username, avatar_url FROM users WHERE username LIKE ? LIMIT 10');
        const users = stmt.all(`%${q}%`);
        res.json(users);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

module.exports = router;
