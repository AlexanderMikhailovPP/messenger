import { useState, useEffect, useRef } from 'react';

/**
 * Debounced typing indicator hook
 * Emits typing events with automatic stop after timeout
 */
export const useTypingIndicator = (socket, channelId, username) => {
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    const sendTyping = () => {
        if (!socket || !channelId) return;

        // Send typing event if not already typing
        if (!isTypingRef.current) {
            socket.emit('typing', { channelId, username });
            isTypingRef.current = true;
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Auto-stop typing after 3 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            if (isTypingRef.current) {
                socket.emit('stop_typing', { channelId, username });
                isTypingRef.current = false;
            }
        }, 3000);
    };

    const stopTyping = () => {
        if (!socket || !channelId) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        if (isTypingRef.current) {
            socket.emit('stop_typing', { channelId, username });
            isTypingRef.current = false;
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            stopTyping();
        };
    }, []);

    return { sendTyping, stopTyping };
};

/**
 * Hook to track who is typing in current channel
 */
export const useTypingUsers = (socket, currentChannelId) => {
    const [typingUsers, setTypingUsers] = useState(new Set());

    useEffect(() => {
        if (!socket) return;

        const handleUserTyping = ({ username, channelId }) => {
            if (channelId === currentChannelId) {
                setTypingUsers(prev => new Set(prev).add(username));
            }
        };

        const handleUserStopTyping = ({ username, channelId }) => {
            if (channelId === currentChannelId) {
                setTypingUsers(prev => {
                    const next = new Set(prev);
                    next.delete(username);
                    return next;
                });
            }
        };

        socket.on('user_typing', handleUserTyping);
        socket.on('user_stop_typing', handleUserStopTyping);

        return () => {
            socket.off('user_typing', handleUserTyping);
            socket.off('user_stop_typing', handleUserStopTyping);
        };
    }, [socket, currentChannelId]);

    return typingUsers;
};
