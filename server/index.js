const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:5174"], // Keep for dev
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/auth');
const channelRoutes = require('./routes/channels');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users'); // Define userRoutes
const db = require('./db');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_channel', (channelId) => {
        socket.join(channelId);
        console.log(`User ${socket.id} joined channel ${channelId}`);
    });

    socket.on('send_message', async (data) => {
        console.log('Server received send_message:', data);
        const { content, userId, channelId } = data;

        // Save to DB
        try {
            const result = await db.insertReturning('INSERT INTO messages (content, user_id, channel_id) VALUES (?, ?, ?) RETURNING id', [content, userId, channelId]);
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
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
