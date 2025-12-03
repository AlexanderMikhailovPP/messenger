const jwt = require('jsonwebtoken');

// Use the same logic as auth.js for JWT secret
const getJwtSecret = () => process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production-' + Date.now();

/**
 * HTTP authentication middleware
 * Verifies JWT access token from HTTP-only cookie
 */
const authMiddleware = (req, res, next) => {
    const token = req.cookies.accessToken;

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;
