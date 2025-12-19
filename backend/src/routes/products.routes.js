import express from 'express';
import db from '../config/database.js';
import authMiddleware from '../middleware/auth.js';
import multer from 'multer';
import { storageService } from '../services/storage.service.js';

const router = express.Router();

// Multer: Accept Images + 1 Video
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image or video files allowed'), false);
        }
    },
});

const uploadFields = upload.fields([
    { name: 'images', maxCount: 7 },
    { name: 'video', maxCount: 1 }
]);

// Helper: Get Likes
async function getLikesCount(productId) {
    const result = await db.oneOrNone('SELECT COALESCE(likes_count, 0) as likes_count FROM products WHERE id = $1', [productId]);
    return parseInt(result?.likes_count) || 0;
}

// ============================================
// REVIEW & LIKE ROUTES (Fixed: Re-added these)
// ============================================

router.get('/:id/reviews', async (req, res, next) => {
    try {
        const { id } = req.params;
        const reviews = await db.any(`
            SELECT r.id, r.rating, r.comment, r.created_at, u.full_name as user
            FROM reviews r JOIN users u ON r.user_id = u.id
            WHERE r.product_id = $1 ORDER BY r.created_at DESC
        `, [id]);
        res.json({ success: true, data: reviews });
    } catch (error) { next(error); }
});

router.post('/:id/reviews', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;
        const userId = req.userId;

        // Check Purchase
        const purchase = await db.oneOrNone(`
            SELECT id FROM orders WHERE user_id = $1 AND status NOT IN ('cancelled', 'pending_payment') 
            AND EXISTS (SELECT 1 FROM order_items WHERE order_id = orders.id AND product_id = $2)
            LIMIT 1
        `, [userId, id]);

        if (!purchase) return res.status(403).json({ error: 'You must purchase this product to review it.' });

        await db.none('INSERT INTO reviews (product_id, user_id, rating, comment, created_at) VALUES ($1, $2, $3, $4, NOW())', [id, userId, rating, comment]);

        // Update stats
        const stats = await db.one('SELECT COUNT(*) as count, COALESCE(AVG(rating), 0) as avg FROM reviews WHERE product_id = $1', [id]);
        await db.none('UPDATE products SET review_count = $1, average_rating = $2 WHERE id = $3', [stats.count, stats.avg, id]);

        res.json({ success: true, message: 'Review added' });
    } catch (error) { next(error); }
});

router.get('/:id/likes', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        let isLiked = false;
        if (req.userId) {
            const like = await db.oneOrNone('SELECT 1 FROM product_likes WHERE user_id = $1 AND product_id = $2', [req.userId, id]);
            isLiked = !!like;
        }
        const likesCount = await getLikesCount(id);
        res.json({ success: true, isLiked, likesCount });
    } catch (error) { next(error); }
});

router.post('/:id/like', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        await db.none('INSERT INTO product_likes (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.userId, id]);
        await db.none('UPDATE products SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = $1', [id]);
        res.json({ success: true, isLiked: true, likesCount: await getLikesCount(id) });
    } catch (error) { next(error); }
});

router.delete('/:id/like', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await db.result('DELETE FROM product_likes WHERE user_id = $1 AND product_id = $2', [req.userId, id]);
        if (result.rowCount > 0) {
            await db.none('UPDATE products SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [id]);
        }
        res.json({ success: true, isLiked: false, likesCount: await getLikesCount(id) });
    } catch (error) { next(error); }
});

// ============================================
// PRODUCT CRUD ROUTES (Cloudinary Enabled)
// ============================================

// GET /api/products
router.get('/', async (req, res, next) => {
    try {
        const { category, sub_category, search } = req.query;
        let query = `
            SELECT p.*, COALESCE(pi1.image_url, p.image_url) as image_url
            FROM products p
            LEFT JOIN LATERAL (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY display_order ASC LIMIT 1) pi1 ON true
            WHERE 1=1
        `;
        const params = [];
        let idx = 1;

        if (category && category !== 'all') { query += ` AND p.category = $${idx++}`; params.push(category); }
        if (sub_category && sub_category !== 'all') { query += ` AND p.sub_category = $${idx++}`; params.push(sub_category); }
        if (search) { query += ` AND (p.name ILIKE $${idx} OR p.description ILIKE $${idx})`; params.push(`%${search}%`); }

        query += ` ORDER BY p.created_at DESC`;
        const products = await db.manyOrNone(query, params);
        res.json({ success: true, data: products });
    } catch (error) { next(error); }
});

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
    try {
        const product = await db.oneOrNone(`
            SELECT p.*, 
                   COALESCE(json_agg(json_build_object('id', pi.id, 'image_url', pi.image_url, 'display_order', pi.display_order)) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) as product_images
            FROM products p
            LEFT JOIN product_images pi ON p.id = pi.product_id
            WHERE p.id = $1
            GROUP BY p.id
        `, [req.params.id]);
        if (!product) return res.status(404).json({ error: 'Not found' });
        res.json({ success: true, data: product });
    } catch (error) { next(error); }
});

// POST /api/products (Admin Create)
router.post('/', authMiddleware, uploadFields, async (req, res, next) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const { name, description, short_description, price, category, sub_category, stock, specifications } = req.body;

        let videoUrl = null;
        if (req.files['video']?.[0]) videoUrl = await storageService.uploadFile(req.files['video'][0], 'products/videos');

        const product = await db.one(`
            INSERT INTO products (name, description, short_description, price, category, sub_category, stock, specifications, video_url, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING id
        `, [name, description, short_description, parseFloat(price), category, sub_category, parseInt(stock), specifications ? JSON.parse(specifications) : {}, videoUrl]);

        if (req.files['images']?.length) {
            const promises = req.files['images'].map(async (file, i) => {
                const url = await storageService.uploadFile(file, 'products/images');
                if (i===0) await db.none('UPDATE products SET image_url = $1 WHERE id = $2', [url, product.id]);
                return db.none('INSERT INTO product_images (product_id, image_url, display_order) VALUES ($1, $2, $3)', [product.id, url, i]);
            });
            await Promise.all(promises);
        }
        res.status(201).json({ success: true, message: 'Created' });
    } catch (error) { next(error); }
});

// PUT /api/products/:id (Admin Update)
router.put('/:id', authMiddleware, uploadFields, async (req, res, next) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const { id } = req.params;
        const { name, description, short_description, price, stock, category, sub_category, specifications, imagesToDelete } = req.body;

        await db.none(`
            UPDATE products SET name=$1, description=$2, short_description=$3, price=$4, stock=$5, category=$6, sub_category=$7, specifications=$8, updated_at=NOW()
            WHERE id=$9
        `, [name, description, short_description, parseFloat(price), parseInt(stock), category, sub_category, specifications ? JSON.parse(specifications) : {}, id]);

        if (req.files['video']?.[0]) {
            const vidUrl = await storageService.uploadFile(req.files['video'][0], 'products/videos');
            await db.none('UPDATE products SET video_url = $1 WHERE id = $2', [vidUrl, id]);
        }

        if (imagesToDelete) {
            const ids = JSON.parse(imagesToDelete);
            if (ids.length) await db.none('DELETE FROM product_images WHERE id = ANY($1::uuid[])', [ids]);
        }

        if (req.files['images']?.length) {
            const maxOrd = await db.one('SELECT COALESCE(MAX(display_order), -1) as m FROM product_images WHERE product_id=$1', [id]);
            let ord = maxOrd.m + 1;
            const promises = req.files['images'].map(async (file) => {
                const url = await storageService.uploadFile(file, 'products/images');
                return db.none('INSERT INTO product_images (product_id, image_url, display_order) VALUES ($1, $2, $3)', [id, url, ord++]);
            });
            await Promise.all(promises);
        }
        res.json({ success: true, message: 'Updated' });
    } catch (error) { next(error); }
});

// DELETE /api/products/:id (Admin Delete)
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });
        await db.none('DELETE FROM products WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) { next(error); }
});

export default router;