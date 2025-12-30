import express from 'express';
import authMiddleware from '../middleware/auth.js';
import db from '../config/database.js';
import nodemailer from 'nodemailer';
const router = express.Router();
// Add this to backend/src/routes/user.routes.js (or any active route file)


router.get('/test-email', async (req, res) => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
        return res.status(500).json({ error: "Missing Environment Variables", user, pass: pass ? "*****" : "MISSING" });
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });

    try {
        // 1. Verify Connection
        await transporter.verify();
        console.log("✅ SMTP Connection Successful");

        // 2. Send Test Mail
        const info = await transporter.sendMail({
            from: `"Test System" <${user}>`,
            to: user, // Send to yourself
            subject: "Test Email from Render",
            text: "If you see this, the email system is WORKING!"
        });

        res.json({ success: true, message: "Email Sent!", info });
    } catch (error) {
        console.error("❌ Email Test Failed:", error);
        res.status(500).json({
            error: "Email Failed",
            code: error.code,
            response: error.response,
            details: error.message
        });
    }
});
// --- PROFILE ---

router.get('/profile', authMiddleware, async (req, res, next) => {
    try {
        const user = await db.oneOrNone(
            `SELECT u.id, u.email, u.full_name, u.phone_number, u.avatar_url, r.role
             FROM users u
                      LEFT JOIN user_roles r ON u.id = r.user_id
             WHERE u.id = $1`,
            [req.userId]
        );
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) { next(err); }
});

router.put('/profile', authMiddleware, async (req, res, next) => {
    try {
        // Handle camelCase from Frontend -> snake_case for DB
        // If the value is undefined (not sent), we want to keep the old value.
        // If the value is sent (even as empty string), we update it.
        const { fullName, phoneNumber, avatarUrl } = req.body;

        // We use COALESCE($1, full_name) in SQL, but if $1 is undefined, pg-promise might complain or treat it as null.
        // Better strategy: Use dynamic query or pass current values if new ones are undefined.

        // Simpler approach for this specific case:
        const user = await db.one(
            `UPDATE users
             SET full_name = COALESCE($1, full_name),
                 phone_number = COALESCE($2, phone_number),
                 avatar_url = COALESCE($3, avatar_url)
             WHERE id = $4
                 RETURNING id, email, full_name, phone_number, avatar_url`,
            [
                fullName !== undefined ? fullName : null,
                phoneNumber !== undefined ? phoneNumber : null,
                avatarUrl !== undefined ? avatarUrl : null,
                req.userId
            ]
        );
        res.json(user);
    } catch (err) { next(err); }
});

// --- ADDRESSES ---

router.get('/addresses', authMiddleware, async (req, res, next) => {
    try {
        const addresses = await db.any('SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC', [req.userId]);
        res.json(addresses);
    } catch (err) { next(err); }
});

router.post('/addresses', authMiddleware, async (req, res, next) => {
    try {
        const { city, state, pincode, isDefault, label, email } = req.body;
        // Map Frontend Camel -> DB Snake
        const fullName = req.body.fullName || req.body.full_name;
        const phone = req.body.phone || req.body.phoneNumber;
        const addressLine1 = req.body.addressLine1 || req.body.address_line1;

        if (isDefault) {
            await db.none('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [req.userId]);
        }

        const newAddr = await db.one(
            `INSERT INTO user_addresses (user_id, full_name, phone, email, address_line1, city, state, pincode, is_default, label)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [req.userId, fullName, phone, email, addressLine1, city, state, pincode, isDefault || false, label || 'Home']
        );
        res.status(201).json(newAddr);
    } catch (err) { next(err); }
});

router.put('/addresses/:id', authMiddleware, async (req, res, next) => {
    try {
        const { city, state, pincode, isDefault, label, email } = req.body;
        // Map Frontend Camel -> DB Snake
        const fullName = req.body.fullName || req.body.full_name;
        const phone = req.body.phone || req.body.phoneNumber;
        const addressLine1 = req.body.addressLine1 || req.body.address_line1;

        if (isDefault) {
            await db.none('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [req.userId]);
        }

        const updated = await db.one(
            `UPDATE user_addresses
             SET full_name=$1, phone=$2, email=$3, address_line1=$4, city=$5, state=$6, pincode=$7, is_default=$8, label=$9, updated_at=NOW()
             WHERE id=$10 AND user_id=$11
                 RETURNING *`,
            [fullName, phone, email, addressLine1, city, state, pincode, isDefault || false, label || 'Home', req.params.id, req.userId]
        );
        res.json(updated);
    } catch (err) { next(err); }
});

router.delete('/addresses/:id', authMiddleware, async (req, res, next) => {
    try {
        await db.none('DELETE FROM user_addresses WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
        res.json({ message: 'Address deleted' });
    } catch (err) { next(err); }
});

// --- SAVED MODELS / QUOTES ---
router.get('/models', authMiddleware, async (req, res, next) => {
    try {
        const models = await db.any('SELECT * FROM saved_models WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
        res.json(models);
    } catch (err) { next(err); }
});

export default router;
