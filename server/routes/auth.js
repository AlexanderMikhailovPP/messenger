const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

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

        // Generate JWT for auto-login after registration
        const token = jwt.sign(
            { userId: id, username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ id, username, token });
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
            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({
                id: user.id,
                username: user.username,
                avatar_url: user.avatar_url,
                token
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
