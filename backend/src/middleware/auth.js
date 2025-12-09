import jwt from 'jsonwebtoken';

// Auth middleware function
/**
 * Express middleware to authenticate user via JWT token from the Authorization header.
 * Attaches userId, userRole, and userEmail to the request object.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next function.
 */
const authMiddleware = (req, res, next) => {
    try {
        // Get authorization header
        const authHeader = req.headers.authorization;

        // Check if header exists and has correct format
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                error: 'No token provided',
                message: 'Please provide a valid JWT token'
            });
            return;
        }

        // Extract token from "Bearer <token>"
        const token = authHeader.substring(7);

        // Ensure JWT_SECRET is available
        if (!process.env.JWT_SECRET) {
            // In a real app, this should be caught during app startup/initialization
            throw new Error('JWT_SECRET is not configured.');
        }

        // Verify token
        // The decoded payload is assigned to 'decoded'.
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Attach user info to request (These properties extend the default Request object)
        req.userId = decoded.userId;
        req.userRole = decoded.role || 'user';
        req.userEmail = decoded.email;

        // Continue to next middleware
        next();
    } catch (error) {
        // Handle different JWT errors
        if (error.name === 'TokenExpiredError') {
            res.status(401).json({ error: 'Token expired' });
        } else if (error.name === 'JsonWebTokenError') {
            res.status(401).json({ error: 'Invalid token' });
        } else {
            // General authentication failure
            res.status(401).json({ error: 'Authentication failed' });
        }
    }
};

export default authMiddleware;