const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
        const info = stmt.run(username, password);
        res.json({ id: info.lastInsertRowid, username });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Username already taken' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
    const user = stmt.get(username, password);

    if (user) {
        res.json({ id: user.id, username: user.username, avatar_url: user.avatar_url });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

module.exports = router;
