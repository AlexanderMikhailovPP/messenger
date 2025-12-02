const jwt = require('jsonwebtoken');

/**
 * Socket.IO authentication middleware
 * Verifies JWT token and attaches user data to socket
 * Falls back to allowing connection without auth for backward compatibility
 */
module.exports = (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        console.warn('Socket connected without token:', socket.id);
        // Allow connection but mark as unauthenticated
        socket.data.userId = null;
        socket.data.username = 'anonymous';
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production');
        socket.data.userId = decoded.userId;
        socket.data.username = decoded.username;
        console.log(`Socket authenticated: ${decoded.username} (${decoded.userId})`);
        next();
    } catch (err) {
        console.error('Socket auth failed:', err.message);
        // Still allow connection but mark as unauthenticated
        socket.data.userId = null;
        socket.data.username = 'anonymous';
        next();
    }
};
