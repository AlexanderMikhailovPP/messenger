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

module.exports = router;
