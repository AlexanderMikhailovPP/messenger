const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:channelId', async (req, res) => {
    const { channelId } = req.params;
    try {
        console.log(`Fetching messages for channel ${channelId}`);
        const result = await db.query(`
      SELECT m.*, u.username, u.avatar_url 
      FROM messages m 
      JOIN users u ON m.user_id = u.id 
      WHERE m.channel_id = ? 
      ORDER BY m.id ASC
    `, [channelId]);
        console.log(`Found ${result.rows.length} messages for channel ${channelId}`);
        res.json(result.rows);
    } catch (err) {
        console.error(`Error fetching messages for channel ${channelId}:`, err);
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

module.exports = router;
