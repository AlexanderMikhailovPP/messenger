const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

router.get('/', async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM channels WHERE type = 'public' OR type IS NULL");
        res.json(result.rows);
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.error(err);
        }
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/', async (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Channel name required' });
    }

    try {
        const result = await db.insertReturning("INSERT INTO channels (name, description, type) VALUES (?, ?, 'public') RETURNING id, name, description, type", [name, description]);
        const id = result.id || result.lastID;
        res.json({ id, name, description, type: 'public' });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505') {
            return res.status(400).json({ error: 'Channel name already taken' });
        }
        if (process.env.NODE_ENV !== 'production') {
            console.error(err);
        }
        res.status(500).json({ error: 'Database error' });
    }
});

// Get channel by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM channels WHERE id = ?', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Channel not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.error(err);
        }
        res.status(500).json({ error: 'Database error' });
    }
});

// Create or get DM channel
router.post('/dm', async (req, res) => {
    const { currentUserId, targetUserId } = req.body;
    if (!currentUserId || !targetUserId) {
        return res.status(400).json({ error: 'User IDs required' });
    }

    const u1 = Math.min(currentUserId, targetUserId);
    const u2 = Math.max(currentUserId, targetUserId);
    const dmName = `dm_${u1}_${u2}`;

    try {
        // Get target user info for display name
        const targetUserRes = await db.query('SELECT username, avatar_url FROM users WHERE id = ?', [targetUserId]);
        const targetUser = targetUserRes.rows[0];
        const displayName = targetUser ? targetUser.username : 'Unknown User';
        const avatarUrl = targetUser ? targetUser.avatar_url : null;

        // Check if exists
        const existing = await db.query('SELECT * FROM channels WHERE name = ?', [dmName]);

        if (existing.rows.length > 0) {
            return res.json({
                ...existing.rows[0],
                displayName,
                avatarUrl,
                otherUserId: targetUserId
            });
        }

        // Create new
        const result = await db.insertReturning("INSERT INTO channels (name, type) VALUES (?, 'dm') RETURNING id, name, type", [dmName]);
        const id = result.id || result.lastID;
        res.json({
            id,
            name: dmName,
            type: 'dm',
            displayName,
            avatarUrl,
            otherUserId: targetUserId
        });
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('DM creation error:', err);
        }
        res.status(500).json({ error: 'Database error' });
    }
});

// Get user's DMs
router.get('/dms/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Find DMs where name contains the userId
        const allDms = await db.query("SELECT * FROM channels WHERE type = 'dm'");

        const channels = allDms.rows.filter(ch => {
            const parts = ch.name.split('_');
            return parts[1] == userId || parts[2] == userId;
        });

        // Enrich with other user's info
        const enrichedChannels = await Promise.all(channels.map(async ch => {
            const parts = ch.name.split('_'); // dm, u1, u2
            const otherId = parts[1] == userId ? parts[2] : parts[1];
            const isSelfChat = parts[1] == parts[2]; // Self-chat: dm_1_1

            const userRes = await db.query('SELECT username, avatar_url, custom_status FROM users WHERE id = ?', [otherId]);
            const otherUser = userRes.rows[0];

            return {
                ...ch,
                displayName: otherUser ? otherUser.username : 'Unknown User',
                avatarUrl: otherUser ? otherUser.avatar_url : null,
                otherUserId: otherId,
                customStatus: otherUser ? otherUser.custom_status : null,
                isSelfChat
            };
        }));

        // Sort to put self-chat first
        enrichedChannels.sort((a, b) => {
            if (a.isSelfChat && !b.isSelfChat) return -1;
            if (!a.isSelfChat && b.isSelfChat) return 1;
            return 0;
        });

        res.json(enrichedChannels);
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('Error fetching DMs:', err);
        }
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
