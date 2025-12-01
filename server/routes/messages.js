const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:channelId', (req, res) => {
    const { channelId } = req.params;
    try {
        const stmt = db.prepare(`
      SELECT m.*, u.username, u.avatar_url 
      FROM messages m 
      JOIN users u ON m.user_id = u.id 
      WHERE m.channel_id = ? 
      ORDER BY m.created_at ASC
    `);
        const messages = stmt.all(channelId);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
