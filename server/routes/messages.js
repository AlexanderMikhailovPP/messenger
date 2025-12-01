const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:channelId', async (req, res) => {
    const { channelId } = req.params;
    try {
        const result = await db.query(`
      SELECT m.*, u.username, u.avatar_url 
      FROM messages m 
      JOIN users u ON m.user_id = u.id 
      WHERE m.channel_id = ? 
      ORDER BY m.created_at ASC
    `, [channelId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
