import { io } from 'socket.io-client';
import { SOCKET_URL } from './config';

let socket = null;

/**
 * Connect Socket.IO with credentials (HTTP-only cookies)
 * Only call this AFTER successful login
 */
export const connectSocket = () => {
    if (socket) return socket;

    socket = io(SOCKET_URL, {
        withCredentials: true, // Send HTTP-only cookies
        autoConnect: false
    });

    socket.connect();

    socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
        // Token might be expired, attempt will be made via axios interceptor
    });

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
    });

    // Reconnect handler - rejoin channels on reconnect
    socket.on('reconnect', (attemptNumber) => {
        console.log(`Socket reconnected after ${attemptNumber} attempts`);
        // Note: Components should handle re-joining their channels via useEffect
    });

    return socket;
};

/**
 * Disconnect and cleanup Socket.IO
 * Call this on logout
 */
export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        console.log('Socket disconnected');
    }
};

/**
 * Get current socket instance
 * Returns null if not connected
 */
export const getSocket = () => socket;
