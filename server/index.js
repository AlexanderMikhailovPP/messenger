const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const path = require('path');
const socketAuth = require('./middleware/socketAuth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || ["http://localhost:5173", "http://localhost:5174"],
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/auth');
const channelRoutes = require('./routes/channels');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const reactionsRoutes = require('./routes/reactions');
const db = require('./db');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reactions', reactionsRoutes);

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
require('./socket/signaling')(io);

// Apply Socket.IO authentication middleware
io.use(socketAuth);

io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;
    console.log(`User ${username} (${userId}) connected:`, socket.id);

    socket.on('join_channel', (channelId) => {
        socket.join(channelId);
        console.log(`User ${userId} joined channel ${channelId}`);
    });

    socket.on('send_message', async (data) => {
        console.log('Server received send_message:', data);
        // Use authenticated userId from socket, NOT from client data
        const { content, channelId } = data;
        const authenticatedUserId = socket.data.userId;

        // Save to DB
        try {
            const result = await db.insertReturning('INSERT INTO messages (content, user_id, channel_id) VALUES (?, ?, ?) RETURNING id', [content, authenticatedUserId, channelId]);
            const messageId = result.id || result.lastID;

            // Fetch full message with user info to broadcast
            const msgResult = await db.query(`
                SELECT m.*, u.username, u.avatar_url 
                FROM messages m 
                JOIN users u ON m.user_id = u.id 
                WHERE m.id = ?
            `, [messageId]);

            const fullMessage = msgResult.rows[0];
            console.log('Broadcasting message to channel:', channelId, fullMessage);

            // Broadcast to channel
            io.to(channelId).emit('receive_message', fullMessage);
        } catch (err) {
            console.error('Error saving message:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User ${username} (${userId}) disconnected:`, socket.id);
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
