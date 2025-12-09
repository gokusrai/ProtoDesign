import express from 'express';
// Assuming the middleware and service are also in JS format
import authMiddleware from '../middleware/auth.js';
import { authService } from "../services/auth.service.js";

const router = express.Router();

/**
 * POST /api/auth/signup
 * Create new user account
 */
router.post('/signup', async (req, res, next) => {
    try {
        // Destructure fields from the request body
        const { email, password, fullName } = req.body;

        // Validation
        if (!email || !password || !fullName) {
            return res.status(400).json({
                error: 'Missing required fields: email, password, fullName'
            });
        }

        // Call auth service
        const result = await authService.signup(email, password, fullName);

        // Return success response
        res.status(201).json({
            message: 'Account created successfully',
            user: result.user,
            token: result.token,
            role: result.role
        });
    } catch (error) {
        next(error);
    }
});



    /**
     * POST /api/auth/login
     * Authenticate user and return JWT token
     */
    router.post('/login', async (req, res, next) => {
        try {
            const { email, password } = req.body;

            // Validation
            if (!email || !password) {
                return res.status(400).json({
                    error: 'Email and password are required'
                });
            }

            // Call auth service
            const result = await authService.login(email, password);

            // Return success response
            res.json({
                message: 'Login successful',
                user: result.user,
                token: result.token,
                role: result.role
            });
        } catch (error) {
            next(error);
        }
    });



    /**
     * POST /api/auth/verify
     * Verify JWT token validity
     */
    router.post('/verify', async (req, res, next) => {
        try {
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({ error: 'Token is required' });
            }

            const result = await authService.verifyToken(token);

            if (result.valid) {
                res.json({
                    valid: true,
                    decoded: result.decoded
                });
            } else {
                res.status(401).json({
                    valid: false,
                    error: result.error
                });
            }
        } catch (error) {
            next(error);
        }
    });


    /**
     * GET /api/auth/me
     * Get current user info (requires auth)
     * * NOTE: The 'req.userId' and 'req.userRole' properties are added by the authMiddleware.
     */
    router.get('/me', authMiddleware, async (req, res, next) => {
        try {
            // req.userId is expected to be attached by the authMiddleware
            const user = await authService.getUserById(req.userId);
            res.json({
                user,
                role: req.userRole // req.userRole is expected to be attached by the authMiddleware
            });
        } catch (error) {
            next(error);
        }
    });



    /**
     * POST /api/auth/change-password
     * Change user password (requires auth)
     */
    router.post(
        '/change-password',
        authMiddleware,
        async (req, res, next) => {
            try {
                const { oldPassword, newPassword } = req.body;

                if (!oldPassword || !newPassword) {
                    return res.status(400).json({
                        error: 'Both old and new passwords are required'
                    });
                }

                // req.userId is expected to be attached by the authMiddleware
                await authService.changePassword(req.userId, oldPassword, newPassword);

                res.json({
                    message: 'Password changed successfully'
                });
            } catch (error) {
                next(error);
            }
        }
    );

export default router;