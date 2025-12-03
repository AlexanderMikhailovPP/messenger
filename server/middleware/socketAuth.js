const jwt = require('jsonwebtoken');

// Use the same logic as auth.js for JWT secret
const getJwtSecret = () => process.env.JWT_SECRET || 'corp-messenger-jwt-secret-change-me-in-production';

/**
 * Socket.IO authentication middleware
 * Verifies JWT token from HTTP-only cookie
 * STRICT: Rejects connection without valid token
 */
module.exports = (socket, next) => {
    // Extract accessToken from cookie header
    const cookies = socket.handshake.headers.cookie;

    if (!cookies) {
        return next(new Error('Authentication required'));
    }

    const token = cookies
        .split('; ')
        .find(c => c.startsWith('accessToken='))
        ?.split('=')[1];

    if (!token) {
        return next(new Error('Authentication required'));
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        socket.data.userId = decoded.userId;
        socket.data.username = decoded.username;
        if (process.env.NODE_ENV !== 'production') {
            console.log(`Socket authenticated: ${decoded.username} (${decoded.userId})`);
        }
        next();
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('Socket auth failed:', err.message);
        }
        next(new Error('Invalid or expired token'));
    }
};
