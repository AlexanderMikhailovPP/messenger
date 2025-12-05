module.exports = (io, db) => {
    const rooms = {}; // channelId -> [socketId]
    const activeCalls = {}; // channelId -> messageId
    const isDev = process.env.NODE_ENV !== 'production';

    io.on('connection', (socket) => {
        // Track handlers per socket for cleanup
        const socketHandlers = new Map();

        socket.on('join-room', async (roomId, userId) => {
            socket.join(roomId);
            const username = socket.data.username;
            if (isDev) {
                console.log(`[Signaling] User ${username} (${userId}) joined room ${roomId}. Socket ID: ${socket.id}`);
            }

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
                    } catch (err) {
                        if (isDev) {
                            console.error(`[Signaling] Failed to add participant:`, err);
                        }
                    }

                    // Send huddle start time to client for synchronized duration
                    if (callInfo.startedAt) {
                        socket.emit('huddle-info', { startedAt: callInfo.startedAt });
                    }
                }
            }

            // Get existing participants in the room BEFORE notifying others
            const room = io.sockets.adapter.rooms.get(roomId);
            const existingParticipants = [];

            if (room) {
                for (const socketId of room) {
                    if (socketId !== socket.id) {
                        const existingSocket = io.sockets.sockets.get(socketId);
                        if (existingSocket) {
                            existingParticipants.push({
                                socketId: socketId,
                                userId: existingSocket.data.userId,
                                username: existingSocket.data.username
                            });
                        }
                    }
                }
            }

            // Send list of existing participants to the new user
            if (existingParticipants.length > 0) {
                if (isDev) {
                    console.log(`[Signaling] Sending existing participants to ${username}:`, existingParticipants);
                }
                socket.emit('existing-participants', existingParticipants);
            }

            // Notify others in the room about the new user
            socket.to(roomId).emit('user-connected', userId, socket.id, username);

            const handleDisconnect = async () => {
                if (isDev) {
                    console.log(`[Signaling] User ${userId} (${socket.id}) disconnected/left room ${roomId}`);
                }
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
                        } catch (err) {
                            if (isDev) {
                                console.error(`[Signaling] Failed to update participant:`, err);
                            }
                        }
                    }
                }

                // Check if room is empty (or will be empty)
                const room = io.sockets.adapter.rooms.get(roomId);
                const roomSize = room ? room.size : 0;

                if (roomSize === 0) {
                    // Check if this was a call room
                    if (roomId.startsWith('call_')) {
                        const channelId = roomId.replace('call_', '');
                        const callInfo = activeCalls[channelId];

                        if (callInfo) {
                            try {
                                // Update message
                                if (callInfo.messageId) {
                                    await db.query(
                                        "UPDATE messages SET content = '📞 Call ended' WHERE id = ?",
                                        [callInfo.messageId]
                                    );

                                    // Broadcast update to the chat channel
                                    io.to(parseInt(channelId)).emit('message_updated', {
                                        id: callInfo.messageId,
                                        content: '📞 Call ended'
                                    });
                                }

                                // Update huddle session
                                if (callInfo.huddleId) {
                                    await db.query(
                                        "UPDATE huddle_sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
                                        [callInfo.huddleId]
                                    );
                                }

                                delete activeCalls[channelId];
                            } catch (err) {
                                if (isDev) {
                                    console.error('[Signaling] Failed to end call:', err);
                                }
                            }
                        }
                    }
                }

                // Cleanup: remove handlers for this room
                cleanupRoomHandlers(roomId);
            };

            // Store handlers for cleanup
            const disconnectHandler = handleDisconnect;
            const leaveHandler = () => {
                socket.leave(roomId);
                handleDisconnect();
            };

            // Cleanup function for this specific room
            const cleanupRoomHandlers = (rid) => {
                if (socketHandlers.has(rid)) {
                    const handlers = socketHandlers.get(rid);
                    socket.off('disconnect', handlers.disconnect);
                    socket.off('leave-room', handlers.leave);
                    socketHandlers.delete(rid);
                }
            };

            // Store handlers
            socketHandlers.set(roomId, {
                disconnect: disconnectHandler,
                leave: leaveHandler
            });

            // Handle disconnect
            socket.on('disconnect', disconnectHandler);

            // Handle manual leave
            socket.on('leave-room', leaveHandler);
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
            // payload: { target: socketId, candidate: RTCIceCandidate, caller: socketId }
            io.to(payload.target).emit('ice-candidate', payload);
        });

        // Broadcast mute state to all participants in the call
        socket.on('mute-update', ({ userId, isMuted, channelId }) => {
            const roomId = `call_${channelId}`;
            socket.to(roomId).emit('mute-update', { userId, isMuted });
        });

        // Broadcast video state to all participants in the call
        socket.on('video-update', ({ userId, isVideoOn, channelId }) => {
            const roomId = `call_${channelId}`;
            // Include socketId for better participant matching
            socket.to(roomId).emit('video-update', { userId, isVideoOn, socketId: socket.id });
        });

        // Broadcast screen share state to all participants in the call
        socket.on('screen-share-update', ({ userId, isScreenSharing, channelId }) => {
            const roomId = `call_${channelId}`;
            socket.to(roomId).emit('screen-share-update', { userId, isScreenSharing, socketId: socket.id });
        });

        socket.on('start_call', async ({ channelId, targetUserId, messageId, callerName, callerAvatar }) => {
            const userId = socket.data.userId;
            // Use passed callerName/Avatar or fallback to socket data
            const finalCallerName = callerName || socket.data.username;

            if (isDev) {
                console.log(`[Signaling] start_call: channelId=${channelId}, targetUserId=${targetUserId}, callerId=${userId}`);
            }

            try {
                // Create huddle session in DB
                const result = await db.insertReturning(
                    `INSERT INTO huddle_sessions (channel_id, started_by, message_id)
                     VALUES (?, ?, ?) RETURNING id`,
                    [channelId, userId, messageId]
                );

                const huddleId = result.id || result.lastID;

                // Store mapping with start time
                activeCalls[channelId] = { messageId, huddleId, startedAt: Date.now() };

                // Add starter as first participant
                await db.query(
                    `INSERT INTO huddle_participants (huddle_id, user_id) VALUES (?, ?)`,
                    [huddleId, userId]
                );

            } catch (err) {
                if (isDev) {
                    console.error(`[Signaling] Failed to create huddle session:`, err);
                }
            }

            const payload = {
                channelId,
                callerId: userId,
                callerName: finalCallerName,
                callerAvatar: callerAvatar || null
            };

            if (targetUserId) {
                // Direct call to user
                if (isDev) {
                    console.log(`[Signaling] Sending incoming_call to user room: ${targetUserId.toString()}`);
                }
                io.to(targetUserId.toString()).emit('incoming_call', payload);
            } else {
                // Broadcast to channel (fallback)
                if (isDev) {
                    console.log(`[Signaling] Sending incoming_call to channel: ${channelId}`);
                }
                socket.to(channelId).emit('incoming_call', payload);
            }
        });
    });
};
