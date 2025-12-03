module.exports = (io, db) => {
    const rooms = {}; // channelId -> [socketId]
    const activeCalls = {}; // channelId -> messageId

    io.on('connection', (socket) => {
        socket.on('join-room', async (roomId, userId) => {
            socket.join(roomId);
            const username = socket.data.username;
            console.log(`[Signaling] User ${username} (${userId}) joined room ${roomId}. Socket ID: ${socket.id}`);

            // Track participant in DB if it's a huddle room
            if (roomId.startsWith('call_')) {
                const channelId = roomId.replace('call_', '');
                const callInfo = activeCalls[channelId];

                if (callInfo && callInfo.huddleId) {
                    try {
                        await db.query(
                            `INSERT INTO huddle_participants (huddle_id, user_id) VALUES (?, ?)`,
                            [callInfo.huddleId, userId]
                        );
                        console.log(`[Signaling] Added participant ${userId} to huddle ${callInfo.huddleId}`);
                    } catch (err) {
                        console.error(`[Signaling] Failed to add participant:`, err);
                    }
                }
            }

            // Notify others in the room
            socket.to(roomId).emit('user-connected', userId, socket.id, username);
            console.log(`[Signaling] Emitted user-connected to room ${roomId} for user ${userId}`);

            const handleDisconnect = async () => {
                console.log(`[Signaling] User ${userId} (${socket.id}) disconnected/left room ${roomId}`);
                socket.to(roomId).emit('user-disconnected', userId, socket.id);

                // Update participant left_at in DB
                if (roomId.startsWith('call_')) {
                    const channelId = roomId.replace('call_', '');
                    const callInfo = activeCalls[channelId];

                    if (callInfo && callInfo.huddleId) {
                        try {
                            await db.query(
                                `UPDATE huddle_participants 
                                 SET left_at = CURRENT_TIMESTAMP 
                                 WHERE huddle_id = ? AND user_id = ? AND left_at IS NULL`,
                                [callInfo.huddleId, userId]
                            );
                            console.log(`[Signaling] Updated left_at for participant ${userId} in huddle ${callInfo.huddleId}`);
                        } catch (err) {
                            console.error(`[Signaling] Failed to update participant:`, err);
                        }
                    }
                }

                // Check if room is empty (or will be empty)
                const room = io.sockets.adapter.rooms.get(roomId);
                const roomSize = room ? room.size : 0;
                console.log(`[Signaling] Room ${roomId} size after disconnect: ${roomSize}`);

                if (roomSize === 0) {
                    console.log(`[Signaling] Room ${roomId} is empty`);

                    // Check if this was a call room
                    if (roomId.startsWith('call_')) {
                        const channelId = roomId.replace('call_', '');
                        console.log(`[Signaling] Checking active calls for channel ${channelId}. ActiveCalls:`, activeCalls);
                        const callInfo = activeCalls[channelId];

                        if (callInfo) {
                            console.log(`[Signaling] Call ended in channel ${channelId}. Huddle ID: ${callInfo.huddleId}`);
                            try {
                                // Update message
                                if (callInfo.messageId) {
                                    await db.query(
                                        "UPDATE messages SET content = '📞 Call ended' WHERE id = ?",
                                        [callInfo.messageId]
                                    );
                                    console.log(`[Signaling] DB updated for message ${callInfo.messageId}`);

                                    // Broadcast update to the chat channel
                                    io.to(parseInt(channelId)).emit('message_updated', {
                                        id: callInfo.messageId,
                                        content: '📞 Call ended'
                                    });
                                    console.log(`[Signaling] Emitted message_updated to channel ${channelId}`);
                                }

                                // Update huddle session
                                if (callInfo.huddleId) {
                                    await db.query(
                                        "UPDATE huddle_sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
                                        [callInfo.huddleId]
                                    );
                                    console.log(`[Signaling] Ended huddle session ${callInfo.huddleId}`);
                                }

                                delete activeCalls[channelId];
                            } catch (err) {
                                console.error('[Signaling] Failed to end call:', err);
                            }
                        } else {
                            console.log(`[Signaling] No active call found for channel ${channelId}`);
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

        socket.on('start_call', async ({ channelId, targetUserId, messageId }) => {
            const userId = socket.data.userId;
            console.log(`[Signaling] User ${userId} started call in channel ${channelId} targeting ${targetUserId}. Message ID: ${messageId}`);

            try {
                // Create huddle session in DB
                const result = await db.insertReturning(
                    `INSERT INTO huddle_sessions (channel_id, started_by, message_id) 
                     VALUES (?, ?, ?) RETURNING id`,
                    [channelId, userId, messageId]
                );

                const huddleId = result.id || result.lastID;
                console.log(`[Signaling] Created huddle session ${huddleId} for channel ${channelId}`);

                // Store mapping
                activeCalls[channelId] = { messageId, huddleId };
                console.log(`[Signaling] Stored active call for channel ${channelId}:`, activeCalls[channelId]);

                // Add starter as first participant
                await db.query(
                    `INSERT INTO huddle_participants (huddle_id, user_id) VALUES (?, ?)`,
                    [huddleId, userId]
                );

            } catch (err) {
                console.error(`[Signaling] Failed to create huddle session:`, err);
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
