import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import db from '../config/database.js';
import { storageService } from '../services/storage.service.js';
import authMiddleware from '../middleware/auth.js'; // Import Auth

const router = express.Router();

// 1. Upload Configuration (Memory Storage to access buffer for Cloudinary)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// 2. Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// ✅ GET MY QUOTES
router.get('/my', authMiddleware, async (req, res) => {
    try {
        // Fetch by user_id
        const quotes = await db.any('SELECT * FROM quotes WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
        res.json(quotes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ POST REQUEST (Protected: Requires Login)
router.post('/request', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { email, phone, notes, specifications } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        // 1. Upload File
        const fileUrl = await storageService.uploadFile(file, 'quotes/stls');

        // 2. Parse Specifications
        let specs = {};
        try {
            specs = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
        } catch (e) {
            console.error("Spec Parse Error", e);
            specs = {};
        }

        const estPrice = specs.estimatedPrice || 0;
        const modelStats = specs.originalStats || {};
        const printDims = specs.printDimensions || {};

        // 3. Insert into DB (LINK TO LOGGED IN USER: req.userId)
        await db.none(`
            INSERT INTO quotes (user_id, email, phone, file_url, file_name, specifications, estimated_price, admin_notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        `, [req.userId, email, phone, fileUrl, file.originalname, specs, estPrice, notes]);

        // 4. Prepare Email Content (The "Dark Theme" Format)
        const adminHtml = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; border: 1px solid #1e293b; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; background-color: #0f172a; color: #e2e8f0;">
                
                <div style="background-color: #1e293b; padding: 20px; text-align: center; border-bottom: 2px solid #3b82f6;">
                    <h2 style="color: #ffffff; margin: 0;">New 3D Printing Request</h2>
                </div>
                
                <div style="padding: 25px;">
                    
                    <div style="background: #1e293b; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
                        <h3 style="margin-top: 0; color: #93c5fd; font-size: 16px; margin-bottom: 10px;">👤 Customer Details</h3>
                        <p style="margin: 5px 0; color: #cbd5e1;"><strong>User ID:</strong> ${req.userId}</p>
                        <p style="margin: 5px 0; color: #cbd5e1;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #60a5fa;">${email}</a></p>
                        <p style="margin: 5px 0; color: #cbd5e1;"><strong>Phone:</strong> ${phone}</p>
                    </div>

                    <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                        
                        <div style="flex: 1; background: #172554; padding: 15px; border-radius: 6px; border: 1px solid #1e3a8a;">
                            <h3 style="margin-top: 0; color: #60a5fa; font-size: 15px; margin-bottom: 10px;">⚙️ Settings</h3>
                            <ul style="list-style: none; padding: 0; margin: 0; font-size: 13px; color: #e2e8f0;">
                                <li style="margin-bottom: 6px;"><strong>Material:</strong> ${specs.material}</li>
                                <li style="margin-bottom: 6px;"><strong>Quality:</strong> ${specs.quality}</li>
                                <li style="margin-bottom: 6px;"><strong>Infill:</strong> ${specs.infill}</li>
                                <li style="margin-bottom: 6px;"><strong>Scale:</strong> ${specs.scale || '100%'}</li>
                            </ul>
                        </div>
                        
                        <div style="flex: 1; background: #27272a; padding: 15px; border-radius: 6px; border: 1px solid #3f3f46;">
                            <h3 style="margin-top: 0; color: #fb923c; font-size: 15px; margin-bottom: 10px;">📊 Model Analysis</h3>
                            <ul style="list-style: none; padding: 0; margin: 0; font-size: 13px; color: #e2e8f0;">
                                <li style="margin-bottom: 6px;"><strong>Volume:</strong> ${modelStats.volume?.toFixed(2) || 0} cm³</li>
                                <li style="margin-bottom: 6px;"><strong>Weight:</strong> ${specs.estimatedWeight || 'N/A'}</li>
                                <li style="margin-bottom: 6px;"><strong>Polygons:</strong> ${specs.polygonCount ? specs.polygonCount.toLocaleString() : 'N/A'}</li>
                                <li style="margin-bottom: 6px;"><strong>Rotation:</strong> ${specs.rotation || '0,0,0'}</li>
                            </ul>
                        </div>
                    </div>

                    <div style="background: #1e293b; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                        <h3 style="margin-top: 0; color: #facc15; font-size: 16px; margin-bottom: 5px;">✏️ Final Dimensions</h3>
                        <p style="font-family: monospace; font-size: 16px; margin: 0; color: #ffffff;">
                            ${printDims.x} x ${printDims.y} x ${printDims.z} cm
                        </p>
                    </div>

                    <div style="border: 1px dashed #475569; padding: 15px; border-radius: 6px; margin-bottom: 25px;">
                         <h3 style="margin-top: 0; color: #94a3b8; font-size: 15px; margin-bottom: 5px;">📝 Customer Notes</h3>
                         <p style="font-style: italic; color: #cbd5e1; margin: 0;">"${notes || "None provided"}"</p>
                    </div>

                    <div style="text-align: center; padding-top: 10px;">
                        <div style="display: inline-block; padding: 12px 25px; background-color: #334155; border-radius: 50px;">
                            <span style="font-weight: bold; color: #94a3b8; margin-right: 15px;">Est. Time: ${specs.estimatedTime}</span>
                            <span style="font-weight: bold; color: #ffffff; font-size: 18px;">Total: ₹${specs.estimatedPrice}</span>
                        </div>
                    </div>
                </div>
                
                <div style="background-color: #1e293b; padding: 12px; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #334155;">
                    <a href="${fileUrl}" style="color: #60a5fa; text-decoration: none; font-weight: bold;">Download ${file.originalname}</a> • ${(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
            </div>
        `;

        // ----------------------------------------------------
        // 5. Send Admin Email (BACKGROUND - NO AWAIT)
        // ----------------------------------------------------
        // ✅ Removed 'await' so UI doesn't freeze
        transporter.sendMail({
            from: `"ProtoDesign System" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Send to Admin
            subject: `New Request: ${file.originalname} - ₹${specs.estimatedPrice}`,
            html: adminHtml,
            attachments: file.size < 10 * 1024 * 1024 ? [{
                filename: file.originalname,
                content: file.buffer
            }] : []
        }).catch(err => console.error('Admin Email Failed:', err));


        // ----------------------------------------------------
        // 6. Send Customer Confirmation Email (BACKGROUND - NO AWAIT)
        // ----------------------------------------------------
        const customerHtml = `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">🚀 We received your request!</h2>
                <p>Hi there,</p>
                <p>Thank you for submitting your model <strong>${file.originalname}</strong>.</p>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Estimated Price:</strong> ₹${specs.estimatedPrice}</p>
                    <p><strong>Next Steps:</strong> Our engineers are reviewing the file for printability. We will contact you soon.</p>
                </div>

                <p>Best regards,<br><strong>The ProtoDesign Team</strong></p>
            </div>
        `;

        // ✅ Removed 'await' so UI doesn't freeze
        transporter.sendMail({
            from: `"ProtoDesign" <${process.env.EMAIL_USER}>`,
            to: email, 
            subject: `Order Received: ${file.originalname}`,
            html: customerHtml
        }).catch(err => console.error('Customer Email Failed:', err));


        res.json({ success: true, message: "Quote requested successfully" });

    } catch (error) {
        console.error('Quote Process Error:', error);
        res.status(500).json({ error: 'Failed to process quote' });
    }
});

// ADMIN ROUTES
router.get('/admin/all', async (req, res) => {
    try {
        const quotes = await db.any('SELECT * FROM quotes ORDER BY created_at DESC');
        res.json(quotes);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await db.none('UPDATE quotes SET status = $1 WHERE id = $2', [status, req.params.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

export default router;
