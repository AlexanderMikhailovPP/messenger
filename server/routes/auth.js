const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        // Use insertReturning to get the ID (and potentially other fields in PG)
        const result = await db.insertReturning('INSERT INTO users (username, password) VALUES (?, ?) RETURNING id, username', [username, password]);
        // For SQLite adapter, result might be { id: ... } or the row if RETURNING is supported/simulated
        // Our adapter returns { id: ... } for SQLite without RETURNING, or the row if RETURNING is present and supported.
        // But better-sqlite3 .run() doesn't return data.
        // Let's rely on the adapter's unified return if possible, or handle it.
        // In our adapter:
        // SQLite: returns { id: lastInsertRowid } (if no RETURNING)
        // PG: returns row

        // To be safe and consistent, let's just use the ID.
        const id = result.id || result.lastID;
        res.json({ id, username });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505') { // 23505 is PG unique violation
            return res.status(400).json({ error: 'Username already taken' });
        }
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        const user = result.rows[0];

        if (user) {
            res.json({ id: user.id, username: user.username, avatar_url: user.avatar_url });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
