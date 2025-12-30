import express from 'express';
import multer from 'multer';
import db from '../config/database.js';
import { storageService } from '../services/storage.service.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Upload Config
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image or video files allowed'), false);
        }
    }
});

// Middleware: Check Admin
const isAdmin = async (req, res, next) => {
    try {
        const result = await db.oneOrNone('SELECT role FROM user_roles WHERE user_id = $1', [req.userId]);
        if (result && result.role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    } catch (error) {
        console.error("❌ Admin Check Error:", error);
        res.status(500).json({ error: 'Failed to verify admin privileges' });
    }
};

// ==========================================
// PUBLIC ROUTES
// ==========================================

router.get('/', async (req, res) => {
    try {
        const { category, sub_category, search, show_archived } = req.query;
        let query = 'SELECT * FROM products WHERE 1=1';
        let params = [];
        let paramCount = 1;

        if (show_archived !== 'true') query += ` AND is_archived = false`;

        if (category && category !== 'all') {
            query += ` AND category = $${paramCount}`;
            params.push(category);
            paramCount++;
        }

        if (sub_category && sub_category !== 'all') {
            query += ` AND (description ILIKE $${paramCount} OR name ILIKE $${paramCount})`;
            params.push(`%${sub_category}%`);
            paramCount++;
        }

        if (search) {
            query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ' ORDER BY created_at DESC';

        const products = await db.any(query, params);

        for (let product of products) {
            const images = await db.any('SELECT * FROM product_images WHERE product_id = $1 ORDER BY display_order ASC', [product.id]);
            product.product_images = images;
        }
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const product = await db.oneOrNone('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const images = await db.any('SELECT * FROM product_images WHERE product_id = $1 ORDER BY display_order ASC', [product.id]);
        product.product_images = images;

        const reviews = await db.any(`
            SELECT r.*, u.full_name as user_name 
            FROM reviews r 
            LEFT JOIN users u ON r.user_id = u.id 
            WHERE r.product_id = $1 
            ORDER BY r.created_at DESC
        `, [product.id]);
        product.reviews = reviews;

        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id/reviews', async (req, res) => {
    try {
        const reviews = await db.any('SELECT r.*, u.full_name as user_name, u.avatar_url FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.product_id = $1 ORDER BY r.created_at DESC', [req.params.id]);
        res.json(reviews);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/reviews', authMiddleware, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const review = await db.one('INSERT INTO reviews (product_id, user_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *', [req.params.id, req.userId, rating, comment]);
        await db.none('UPDATE products SET average_rating = (SELECT AVG(rating) FROM reviews WHERE product_id = $1), review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1) WHERE id = $1', [req.params.id]);
        res.json(review);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/like', authMiddleware, async (req, res) => {
    try {
        const existing = await db.oneOrNone('SELECT * FROM product_likes WHERE product_id = $1 AND user_id = $2', [req.params.id, req.userId]);
        if (existing) {
            await db.none('DELETE FROM product_likes WHERE product_id = $1 AND user_id = $2', [req.params.id, req.userId]);
            await db.none('UPDATE products SET likes_count = likes_count - 1 WHERE id = $1', [req.params.id]);
            res.json({ liked: false });
        } else {
            await db.none('INSERT INTO product_likes (product_id, user_id) VALUES ($1, $2)', [req.params.id, req.userId]);
            await db.none('UPDATE products SET likes_count = likes_count + 1 WHERE id = $1', [req.params.id]);
            res.json({ liked: true });
        }
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:id/likes', async (req, res) => { res.json({ message: "Use POST /like to toggle" }); });

// ==========================================
// ADMIN ROUTES
// ==========================================

// Create Product
router.post('/', authMiddleware, isAdmin, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        const { name, description, short_description, price, category, stock, specifications } = req.body;
        let videoUrl = null;

        if (req.files['video']) {
            videoUrl = await storageService.uploadFile(req.files['video'][0], 'products/videos');
        }

        // ✅ ADDED short_description to INSERT
        const product = await db.one(
            `INSERT INTO products (name, description, short_description, price, category, stock, specifications, video_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, description, short_description, price, category, stock, specifications, videoUrl]
        );

        if (req.files['images']) {
            for (let i = 0; i < req.files['images'].length; i++) {
                const url = await storageService.uploadFile(req.files['images'][i], 'products');
                await db.none(
                    'INSERT INTO product_images (product_id, image_url, display_order) VALUES ($1, $2, $3)',
                    [product.id, url, i]
                );
                if (i === 0) {
                    await db.none('UPDATE products SET image_url = $1 WHERE id = $2', [url, product.id]);
                }
            }
        }
        res.status(201).json(product);
    } catch (error) {
        console.error("Create Product Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Update Product
router.put('/:id', authMiddleware, isAdmin, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        const { name, description, short_description, price, category, stock, specifications, imagesToDelete } = req.body;

        // ✅ ADDED short_description to UPDATE
        await db.none(
            `UPDATE products 
             SET name=$1, description=$2, short_description=$3, price=$4, category=$5, stock=$6, specifications=$7, updated_at=NOW()
             WHERE id=$8`,
            [name, description, short_description, price, category, stock, specifications, req.params.id]
        );

        if (req.files['video']) {
            const videoUrl = await storageService.uploadFile(req.files['video'][0], 'products/videos');
            await db.none('UPDATE products SET video_url = $1 WHERE id = $2', [videoUrl, req.params.id]);
        }

        if (imagesToDelete) {
            let idsToDelete = [];
            try { idsToDelete = JSON.parse(imagesToDelete); } catch (e) { idsToDelete = [imagesToDelete]; }
            
            if (idsToDelete.length > 0) {
                await db.none('DELETE FROM product_images WHERE id IN ($1:csv)', [idsToDelete]);
            }
        }

        if (req.files['images']) {
            const maxOrdResult = await db.one('SELECT COALESCE(MAX(display_order), -1) as m FROM product_images WHERE product_id=$1', [req.params.id]);
            let nextOrder = maxOrdResult.m + 1;

            for (const file of req.files['images']) {
                const url = await storageService.uploadFile(file, 'products');
                await db.none('INSERT INTO product_images (product_id, image_url, display_order) VALUES ($1, $2, $3)', [req.params.id, url, nextOrder++]);
            }
        }

        const firstImage = await db.oneOrNone('SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY display_order ASC LIMIT 1', [req.params.id]);
        if (firstImage) {
            await db.none('UPDATE products SET image_url = $1 WHERE id = $2', [firstImage.image_url, req.params.id]);
        }

        res.json({ message: "Product updated successfully" });
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', authMiddleware, isAdmin, async (req, res) => {
    try { await db.none('UPDATE products SET is_archived = true WHERE id = $1', [req.params.id]); res.json({ message: 'Archived' }); } catch (error) { res.status(500).json({ error: error.message }); }
});
router.patch('/:id/restore', authMiddleware, isAdmin, async (req, res) => {
    try { await db.none('UPDATE products SET is_archived = false WHERE id = $1', [req.params.id]); res.json({ message: 'Restored' }); } catch (error) { res.status(500).json({ error: error.message }); }
});

export default router;
