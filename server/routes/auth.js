const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const result = await db.insertReturning('INSERT INTO users (username, password) VALUES (?, ?) RETURNING id, username', [username, hashedPassword]);
        const id = result.id || result.lastID;
        res.json({ id, username });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505') {
            return res.status(400).json({ error: 'Username already taken' });
        }
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Get user by username only
        const result = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (isValidPassword) {
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
