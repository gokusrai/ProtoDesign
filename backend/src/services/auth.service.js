import db from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Authentication service
export const authService = {
    /**
     * User signup - Create new user account
     */
    async signup(email, password, fullName) {
        // Validation
        if (!email || !password || !fullName) {
            throw new Error('Email, password, and full name are required');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        // Check if user already exists
        const existing = await db.oneOrNone(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existing) {
            throw new Error('Email already registered');
        }

        // Hash password (10 salt rounds)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user in database
        const user = await db.one(
            `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, created_at`,
            [email.toLowerCase(), hashedPassword, fullName]
        );

        // Assign default 'user' role
        await db.none(
            'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
            [user.id, 'user']
        );

        // Generate JWT token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not defined');
        }

        const signOptions = {
            expiresIn: (process.env.JWT_EXPIRY || '7d'),
        };

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: 'user',
            },
            jwtSecret,
            signOptions
        );


        return {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name, // Note: Use snake_case from DB result
                createdAt: user.created_at // Note: Use snake_case from DB result
            },
            token,
            role: 'user'
        };
    },

    /**
     * User login - Authenticate existing user
     */
    async login(email, password) {
        // Validation
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        // Find user by email
        const user = await db.oneOrNone(
            'SELECT id, email, password_hash, full_name FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        // Check if user exists
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Verify password
        // Note: property is password_hash in DB, accessed as passwordHash by pg-promise
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            throw new Error('Invalid credentials');
        }

        // Get user role
        const userRole = await db.oneOrNone(
            `SELECT role FROM user_roles 
       WHERE user_id = $1 
       ORDER BY created_at DESC LIMIT 1`,
            [user.id]
        );

        const role = userRole?.role || 'user';

        // Generate JWT token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not defined');
        }

        const signOptions = {
            expiresIn: (process.env.JWT_EXPIRY || '7d'),
        };

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role
            },
            jwtSecret,
            signOptions
        );
        return {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name, // Note: Use snake_case from DB result
                createdAt: user.created_at // Note: Use snake_case from DB result
            },
            token,
            role
        };
    },

    /**
     * Verify JWT token validity
     */
    async verifyToken(token) {
        try {
            if (!process.env.JWT_SECRET) {
                throw new Error('JWT_SECRET is not defined');
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            return {
                valid: true,
                decoded
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    },

    /**
     * Get user by ID
     */
    async getUserById(userId) {
        const user = await db.oneOrNone(
            'SELECT id, email, full_name, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (!user) {
            throw new Error('User not found');
        }

        return {
            id: user.id,
            email: user.email,
            fullName: user.full_name, // Note: Use snake_case from DB result
            createdAt: user.created_at // Note: Use snake_case from DB result
        };
    },

    /**
     * Change user password
     */
    async changePassword(userId, oldPassword, newPassword) {
        // Validation
        if (!oldPassword || !newPassword) {
            throw new Error('Both old and new passwords are required');
        }

        if (newPassword.length < 6) {
            throw new Error('New password must be at least 6 characters');
        }

        // Get current password hash
        const user = await db.oneOrNone(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

        if (!user) {
            throw new Error('User not found');
        }

        // Verify old password
        // Note: property is password_hash in DB, accessed as passwordHash by pg-promise
        const passwordMatch = await bcrypt.compare(oldPassword, user.password_hash);

        if (!passwordMatch) {
            throw new Error('Current password is incorrect');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await db.none(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [hashedPassword, userId]
        );
    }
};