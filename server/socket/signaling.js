module.exports = (io, db) => {
    const rooms = {}; // channelId -> [socketId]
    const activeCalls = {}; // channelId -> messageId

    io.on('connection', (socket) => {
        socket.on('join-room', (roomId, userId) => {
            socket.join(roomId);
            const username = socket.data.username;
            console.log(`[Signaling] User ${username} (${userId}) joined room ${roomId}. Socket ID: ${socket.id}`);

            // Notify others in the room
            socket.to(roomId).emit('user-connected', userId, socket.id, username);
            console.log(`[Signaling] Emitted user-connected to room ${roomId} for user ${userId}`);

            const handleDisconnect = async () => {
                console.log(`User ${userId} (${socket.id}) disconnected/left room ${roomId}`);
                socket.to(roomId).emit('user-disconnected', userId, socket.id);

                // Check if room is empty (or will be empty)
                const room = io.sockets.adapter.rooms.get(roomId);
                if (!room || room.size === 0) {
                    console.log(`Room ${roomId} is empty`);

                    // Check if this was a call room
                    if (roomId.startsWith('call_')) {
                        const channelId = roomId.replace('call_', '');
                        const messageId = activeCalls[channelId];

                        if (messageId) {
                            console.log(`Call ended in channel ${channelId}. Updating message ${messageId}`);
                            try {
                                await db.query(
                                    "UPDATE messages SET content = '📞 Call ended' WHERE id = ?",
                                    [messageId]
                                );

                                // Broadcast update to the chat channel
                                io.to(channelId).emit('message_updated', {
                                    id: messageId,
                                    content: '📞 Call ended'
                                });

                                delete activeCalls[channelId];
                            } catch (err) {
                                console.error('Failed to update call message:', err);
                            }
                        }
                    }
                }
            };

            // Handle disconnect
            socket.on('disconnect', handleDisconnect);

            // Handle manual leave
            socket.on('leave-room', () => {
                socket.leave(roomId);
                handleDisconnect();
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

        socket.on('start_call', ({ channelId, targetUserId, messageId }) => {
            const userId = socket.data.userId;
            console.log(`User ${userId} started call in channel ${channelId} targeting ${targetUserId}. Message ID: ${messageId}`);

            if (messageId) {
                activeCalls[channelId] = messageId;
            }

            const payload = { channelId, callerId: userId };

            if (targetUserId) {
                // Direct call to user
                io.to(targetUserId.toString()).emit('incoming_call', payload);
            } else {
                // Broadcast to channel (fallback)
                socket.to(channelId).emit('incoming_call', payload);
            }
        });
    });
};
