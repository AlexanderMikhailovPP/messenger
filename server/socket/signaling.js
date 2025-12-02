module.exports = (io) => {
    const rooms = {}; // channelId -> [socketId]

    io.on('connection', (socket) => {
        socket.on('join-room', (roomId, userId) => {
            socket.join(roomId);
            console.log(`User ${userId} (${socket.id}) joined room ${roomId}`);

            // Notify others in the room
            socket.to(roomId).emit('user-connected', userId, socket.id);

            // Handle disconnect
            socket.on('disconnect', () => {
                console.log(`User ${userId} (${socket.id}) disconnected`);
                socket.to(roomId).emit('user-disconnected', userId, socket.id);
            });

            // Handle manual leave
            socket.on('leave-room', () => {
                console.log(`User ${userId} (${socket.id}) left room ${roomId}`);
                socket.leave(roomId);
                socket.to(roomId).emit('user-disconnected', userId, socket.id);
            });
        });

        // Signaling
        socket.on('offer', (payload) => {
            // payload: { target: socketId, caller: socketId, sdp: RTCSessionDescription }
            io.to(payload.target).emit('offer', payload);
        });

        socket.on('answer', (payload) => {
            // payload: { target: socketId, caller: socketId, sdp: RTCSessionDescription }
            io.to(payload.target).emit('answer', payload);
        });

        socket.on('ice-candidate', (payload) => {
            // payload: { target: socketId, candidate: RTCIceCandidate }
            io.to(payload.target).emit('ice-candidate', payload);
        });

        socket.on('start_call', ({ channelId, userId }) => {
            // Broadcast to all users in the channel (assuming they are in a room named channelId or similar)
            // Since we don't have explicit channel rooms in this file, we rely on the client to join them.
            // But wait, index.js handles channel joining.
            // Let's assume users are in room `channel_${channelId}`.
            socket.to(`channel_${channelId}`).emit('incoming_call', { channelId, callerId: userId });
        });
    });
};
