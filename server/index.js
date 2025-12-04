const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

dotenv.config();

const path = require('path');
const socketAuth = require('./middleware/socketAuth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || ["http://localhost:5173", "http://localhost:5174"],
        methods: ["GET", "POST"],
        credentials: true // Allow cookies
    },
    // Increase timeouts for better stability during calls
    pingTimeout: 60000,      // 60 seconds (default 20s)
    pingInterval: 25000,     // 25 seconds (default 25s)
    upgradeTimeout: 30000,   // 30 seconds for upgrade
    maxHttpBufferSize: 1e8   // 100 MB for large payloads
});

app.use(cors({
    origin: process.env.CORS_ORIGIN || ["http://localhost:5173", "http://localhost:5174"],
    credentials: true // Allow cookies
}));
app.use(cookieParser());
app.use(express.json());

const authRoutes = require('./routes/auth');
const channelRoutes = require('./routes/channels');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const reactionsRoutes = require('./routes/reactions');
const { initReactions } = require('./routes/reactions');
const scheduledRoutes = require('./routes/scheduled');
const db = require('./db');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reactions', reactionsRoutes);
app.use('/api/scheduled', scheduledRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Initialize WebRTC signaling
require('./socket/signaling')(io, db);

// Initialize message scheduler
const { initScheduler } = require('./scheduler');
initScheduler(io);

// Initialize reactions with socket.io
initReactions(io);

// Apply Socket.IO authentication middleware
io.use(socketAuth);

const isDev = process.env.NODE_ENV !== 'production';

// Track online users: Map<userId, { sockets: Set<socketId>, status: 'active' | 'away' }>
const onlineUsers = new Map();

// Helper to get online user IDs with their statuses
const getOnlineUserIds = () => Array.from(onlineUsers.keys());
const getUserStatuses = () => {
    const statuses = {};
    onlineUsers.forEach((data, odId) => {
        statuses[odId] = data.status;
    });
    return statuses;
};

// API endpoint to get online users
app.get('/api/users/online', (req, res) => {
    res.json(getOnlineUserIds());
});

io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;

    if (isDev) {
        console.log(`User ${username} (${userId}) connected:`, socket.id);
    }

    // Track user as online with active status
    if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, { sockets: new Set(), status: 'active' });
    }
    onlineUsers.get(userId).sockets.add(socket.id);

    // Broadcast user online status with active state to all clients
    io.emit('user_online', { userId, status: 'active' });

    // Join user-specific room for direct signaling
    const userRoom = userId.toString();
    socket.join(userRoom);
    if (isDev) {
        console.log(`[Socket] User ${userId} joined personal room: "${userRoom}"`);
    }

    // Send current online users with statuses to this socket
    socket.emit('online_users', getUserStatuses());

    socket.on('join_channel', (channelId) => {
        socket.join(channelId);
        if (isDev) {
            console.log(`User ${userId} joined channel ${channelId}`);
        }
    });

    socket.on('send_message', async (data, callback) => {
        // Always use authenticated userId from socket for security
        const { content, channelId, threadId } = data;
        const authenticatedUserId = socket.data.userId;

        if (!authenticatedUserId) {
            if (isDev) {
                console.error('Cannot send message: userId not found');
            }
            return;
        }

        // Save to DB
        try {
            let result;
            if (threadId) {
                // Thread reply
                result = await db.insertReturning(
                    'INSERT INTO messages (content, user_id, channel_id, thread_id) VALUES (?, ?, ?, ?) RETURNING id',
                    [content, authenticatedUserId, channelId, threadId]
                );
            } else {
                // Regular message
                result = await db.insertReturning(
                    'INSERT INTO messages (content, user_id, channel_id) VALUES (?, ?, ?) RETURNING id',
                    [content, authenticatedUserId, channelId]
                );
            }
            const messageId = result.id || result.lastID;

            // Fetch full message with user info to broadcast
            const msgResult = await db.query(`
                SELECT m.*, u.username, u.avatar_url
                FROM messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.id = ?
            `, [messageId]);

            const fullMessage = msgResult.rows[0];

            if (threadId) {
                // Broadcast to thread subscribers
                io.to(`thread_${threadId}`).emit('thread_reply', fullMessage);

                // Also notify main channel about thread update (for reply count)
                const replyCountResult = await db.query(
                    'SELECT COUNT(*) as count FROM messages WHERE thread_id = ?',
                    [threadId]
                );
                io.to(channelId).emit('thread_updated', {
                    messageId: threadId,
                    replyCount: replyCountResult.rows[0].count,
                    lastReply: fullMessage
                });
            } else {
                // Broadcast to channel (for users who have joined the channel)
                io.to(channelId).emit('receive_message', fullMessage);

                // Also send to user's personal rooms for unread notifications
                // Get channel info to check if it's a DM
                const channelRes = await db.query('SELECT * FROM channels WHERE id = ?', [channelId]);
                const channel = channelRes.rows[0];

                if (channel && channel.type === 'dm') {
                    // DM channel - send to both users' personal rooms
                    const parts = channel.name.split('_'); // dm_userId1_userId2
                    const userId1 = parts[1];
                    const userId2 = parts[2];

                    // Emit to both users' personal rooms (they may not have joined the channel room)
                    io.to(userId1).emit('receive_message', fullMessage);
                    io.to(userId2).emit('receive_message', fullMessage);

                    if (isDev) {
                        console.log(`[DM] Message sent to personal rooms: ${userId1}, ${userId2}`);
                    }
                }
            }

            if (callback) {
                callback({ id: messageId });
            }
        } catch (err) {
            if (isDev) {
                console.error('Error saving message:', err);
            }
        }
    });

    // Join thread room for real-time updates
    socket.on('join_thread', (threadId) => {
        socket.join(`thread_${threadId}`);
        if (isDev) {
            console.log(`User ${userId} joined thread ${threadId}`);
        }
    });

    socket.on('leave_thread', (threadId) => {
        socket.leave(`thread_${threadId}`);
        if (isDev) {
            console.log(`User ${userId} left thread ${threadId}`);
        }
    });

    // Typing indicator
    socket.on('typing', (data) => {
        const { channelId, username } = data;
        socket.to(channelId).emit('user_typing', { username, channelId });
    });

    socket.on('stop_typing', (data) => {
        const { channelId, username } = data;
        socket.to(channelId).emit('user_stop_typing', { username, channelId });
    });

    // User activity status update (active/away)
    socket.on('update_status', (status) => {
        if (onlineUsers.has(userId)) {
            const userData = onlineUsers.get(userId);
            if (userData.status !== status) {
                userData.status = status;
                io.emit('user_status_changed', { userId, status });
                if (isDev) {
                    console.log(`User ${username} (${userId}) status changed to: ${status}`);
                }
            }
        }
    });

    socket.on('disconnect', () => {
        if (isDev) {
            console.log(`User ${username} (${userId}) disconnected:`, socket.id);
        }

        // Remove socket from online users
        if (onlineUsers.has(userId)) {
            onlineUsers.get(userId).sockets.delete(socket.id);
            // If no more sockets for this user, they're offline
            if (onlineUsers.get(userId).sockets.size === 0) {
                onlineUsers.delete(userId);
                // Broadcast user offline status
                io.emit('user_offline', { userId });
            }
        }
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
