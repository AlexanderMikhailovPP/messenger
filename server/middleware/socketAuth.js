const jwt = require('jsonwebtoken');

/**
 * Socket.IO authentication middleware
 * Verifies JWT token and attaches user data to socket
 */
module.exports = (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication required'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production');
        socket.data.userId = decoded.userId;
        socket.data.username = decoded.username;
        next();
    } catch (err) {
        console.error('Socket auth failed:', err.message);
        next(new Error('Invalid token'));
    }
};
