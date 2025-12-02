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

        socket.on('start_call', ({ channelId }) => {
            const userId = socket.data.userId;
            console.log(`User ${userId} started call in channel ${channelId}`);
            // Broadcast to all users in the channel room (they join this room via join_channel event)
            socket.to(channelId).emit('incoming_call', { channelId, callerId: userId });
        });
    });
};
