const db = require('./db');

let io = null;

// Initialize scheduler with socket.io instance
const initScheduler = (socketIo) => {
    io = socketIo;

    // Check for scheduled messages every 30 seconds
    setInterval(checkScheduledMessages, 30 * 1000);

    // Initial check
    setTimeout(checkScheduledMessages, 5000);

    console.log('Message scheduler initialized');
};

// Check and send due messages
const checkScheduledMessages = async () => {
    try {
        const now = new Date().toISOString();

        // Get pending messages that are due
        const result = await db.query(`
            SELECT sm.*, u.username, u.avatar_url
            FROM scheduled_messages sm
            JOIN users u ON sm.user_id = u.id
            WHERE sm.status = 'pending' AND sm.scheduled_at <= ?
        `, [now]);

        for (const scheduled of result.rows) {
            try {
                // Insert the actual message
                const messageResult = await db.query(
                    `INSERT INTO messages (content, user_id, channel_id)
                     VALUES (?, ?, ?) RETURNING *`,
                    [scheduled.content, scheduled.user_id, scheduled.channel_id]
                );

                const newMessage = messageResult.rows[0];

                // Mark scheduled message as sent
                await db.query(
                    "UPDATE scheduled_messages SET status = 'sent' WHERE id = ?",
                    [scheduled.id]
                );

                // Emit via socket.io to the channel
                if (io) {
                    const messageData = {
                        ...newMessage,
                        username: scheduled.username,
                        avatar_url: scheduled.avatar_url
                    };

                    io.to(`channel_${scheduled.channel_id}`).emit('receive_message', messageData);
                }

                console.log(`Scheduled message ${scheduled.id} sent to channel ${scheduled.channel_id}`);
            } catch (err) {
                console.error(`Failed to send scheduled message ${scheduled.id}:`, err);

                // Mark as failed
                await db.query(
                    "UPDATE scheduled_messages SET status = 'failed' WHERE id = ?",
                    [scheduled.id]
                );
            }
        }
    } catch (err) {
        console.error('Scheduler error:', err);
    }
};

module.exports = { initScheduler };
