const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { uploadFile, deleteFile, isR2Configured } = require('../storage/r2-client');

// Configure multer for memory storage (we'll upload to R2 or save locally)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Search users and channels
router.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.json({ users: [], channels: [] });
    }

    try {
        // Search users
        const usersResult = await db.query(
            'SELECT id, username, avatar_url FROM users WHERE username LIKE ? LIMIT 10',
            [`%${q}%`]
        );

        // Search channels
        const channelsResult = await db.query(
            'SELECT id, name, description FROM channels WHERE name LIKE ? AND type = ? LIMIT 10',
            [`%${q}%`, 'public']
        );

        res.json({
            users: usersResult.rows,
            channels: channelsResult.rows
        });
    } catch (error) {
        console.error('Error searching:', error);
        res.status(500).json({ error: 'Failed to search' });
    }
});

// Upload avatar
router.post('/avatar', upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        let avatarUrl;

        if (isR2Configured()) {
            // Upload to Cloudflare R2
            avatarUrl = await uploadFile(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype,
                'avatars'
            );
            console.log('Avatar uploaded to R2:', avatarUrl);
        } else {
            // Fallback to local filesystem
            const fs = require('fs').promises;
            const uploadDir = path.join(__dirname, '../uploads/avatars');

            // Ensure directory exists
            await fs.mkdir(uploadDir, { recursive: true });

            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = 'avatar-' + uniqueSuffix + path.extname(req.file.originalname);
            const filepath = path.join(uploadDir, filename);

            await fs.writeFile(filepath, req.file.buffer);
            avatarUrl = `/uploads/avatars/${filename}`;
            console.log('Avatar saved locally:', avatarUrl);
        }

        res.json({ avatar_url: avatarUrl });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: 'Failed to upload avatar' });
    }
});

// Update user profile
router.put('/profile', async (req, res) => {
    const { userId, username, avatar_url } = req.body;

    if (!userId || !username) {
        return res.status(400).json({ error: 'User ID and username are required' });
    }

    try {
        // Get old avatar URL to delete it if changed
        const userResult = await db.query('SELECT avatar_url FROM users WHERE id = ?', [userId]);
        const oldAvatarUrl = userResult.rows[0]?.avatar_url;

        // Update user profile
        await db.query(
            'UPDATE users SET username = ?, avatar_url = ? WHERE id = ?',
            [username, avatar_url || null, userId]
        );

        // Delete old avatar from R2 if it exists and is different
        if (oldAvatarUrl && oldAvatarUrl !== avatar_url && isR2Configured()) {
            // Only delete if it's an R2 URL (starts with R2_PUBLIC_URL)
            if (oldAvatarUrl.startsWith('http')) {
                await deleteFile(oldAvatarUrl);
            }
        }

        res.json({ success: true });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505') {
            return res.status(400).json({ error: 'Username already taken' });
        }
        console.error('Profile update error:', err);
        console.error('Error details:', {
            message: err.message,
            code: err.code,
            userId,
            username,
            avatar_url
        });
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;
