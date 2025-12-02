const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-change-in-production';

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await db.insertReturning('INSERT INTO users (username, password) VALUES (?, ?) RETURNING id, username', [username, hashedPassword]);
        const id = result.id || result.lastID;

        // Generate tokens
        const accessToken = jwt.sign(
            { userId: id, username },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { userId: id, username },
            JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        // Set HTTP-only cookies
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000 // 15 min
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

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
        const result = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (isValidPassword) {
            // Generate tokens
            const accessToken = jwt.sign(
                { userId: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: '15m' }
            );

            const refreshToken = jwt.sign(
                { userId: user.id, username: user.username },
                JWT_REFRESH_SECRET,
                { expiresIn: '7d' }
            );

            // Set HTTP-only cookies
            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 15 * 60 * 1000 // 15 min
            });

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            res.json({
                id: user.id,
                username: user.username,
                avatar_url: user.avatar_url
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Verify endpoint - check if user has valid token
router.get('/verify', (req, res) => {
    const token = req.cookies.accessToken;

    if (!token) {
        return res.status(401).json({ error: 'No token' });
    }

    try {
        jwt.verify(token, JWT_SECRET);
        res.json({ valid: true });
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Refresh token endpoint
router.post('/refresh', (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token' });
    }

    try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

        // Generate new access token
        const newAccessToken = jwt.sign(
            { userId: decoded.userId, username: decoded.username },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000
        });

        res.json({ success: true });
    } catch (err) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ success: true });
});

module.exports = router;
