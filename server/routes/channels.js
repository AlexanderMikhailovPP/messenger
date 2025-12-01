const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
    try {
        const stmt = db.prepare("SELECT * FROM channels WHERE type = 'public' OR type IS NULL");
        const channels = stmt.all();
        res.json(channels);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/', (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Channel name required' });
    }

    try {
        const stmt = db.prepare("INSERT INTO channels (name, description, type) VALUES (?, ?, 'public')");
        const info = stmt.run(name, description);
        res.json({ id: info.lastInsertRowid, name, description, type: 'public' });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Channel name already taken' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

// Create or get DM channel
router.post('/dm', (req, res) => {
    const { currentUserId, targetUserId } = req.body;
    if (!currentUserId || !targetUserId) {
        return res.status(400).json({ error: 'User IDs required' });
    }

    const u1 = Math.min(currentUserId, targetUserId);
    const u2 = Math.max(currentUserId, targetUserId);
    const dmName = `dm_${u1}_${u2}`;

    try {
        // Check if exists
        const stmt = db.prepare('SELECT * FROM channels WHERE name = ?');
        const existing = stmt.get(dmName);

        if (existing) {
            return res.json(existing);
        }

        // Create new
        const insert = db.prepare("INSERT INTO channels (name, type) VALUES (?, 'dm')");
        const info = insert.run(dmName);
        res.json({ id: info.lastInsertRowid, name: dmName, type: 'dm' });
    } catch (err) {
        console.error('DM creation error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get user's DMs
router.get('/dms/:userId', (req, res) => {
    const { userId } = req.params;
    try {
        // Find DMs where name contains the userId
        // Note: We fetch all DMs and filter in JS to handle the naming convention dm_u1_u2 correctly
        // because SQL LIKE is tricky with the underscores and variable positions
        const stmt = db.prepare("SELECT * FROM channels WHERE type = 'dm'");
        const allDms = stmt.all();

        const channels = allDms.filter(ch => {
            const parts = ch.name.split('_');
            return parts[1] == userId || parts[2] == userId;
        });

        // Enrich with other user's info
        const enrichedChannels = channels.map(ch => {
            const parts = ch.name.split('_'); // dm, u1, u2
            const otherId = parts[1] == userId ? parts[2] : parts[1];

            const userStmt = db.prepare('SELECT username, avatar_url FROM users WHERE id = ?');
            const otherUser = userStmt.get(otherId);

            return {
                ...ch,
                displayName: otherUser ? otherUser.username : 'Unknown User',
                avatarUrl: otherUser ? otherUser.avatar_url : null
            };
        });

        res.json(enrichedChannels);
    } catch (err) {
        console.error('Error fetching DMs:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
