const jwt = require('jsonwebtoken');

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
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production');
        socket.data.userId = decoded.userId;
        socket.data.username = decoded.username;
        console.log(`Socket authenticated: ${decoded.username} (${decoded.userId})`);
        next();
    } catch (err) {
        console.error('Socket auth failed:', err.message);
        next(new Error('Invalid or expired token'));
    }
};
