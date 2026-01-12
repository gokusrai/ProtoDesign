import express from 'express';
import multer from 'multer';
import db from '../config/database.js';
import { storageService } from '../services/storage.service.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
});

// ✅ Robust Admin Middleware
const isAdmin = async (req, res, next) => {
    try {
        let role = null;
        try {
            const user = await db.oneOrNone('SELECT role FROM users WHERE id = $1', [req.userId]);
            if (user && user.role) role = user.role;
        } catch (e) {}

        if (role !== 'admin') {
            try {
                const roleObj = await db.oneOrNone('SELECT role FROM user_roles WHERE user_id = $1', [req.userId]);
                if (roleObj && roleObj.role) role = roleObj.role;
            } catch (e) {}
        }

        if (role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    } catch (error) {
        console.error("Admin Verify Error:", error);
        res.status(500).json({ error: 'Failed to verify admin privileges' });
    }
};

// CSV Parser
const parseCSV = (buffer) => {
    const text = buffer.toString();
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentCell += '"'; i++;
            } else insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentCell.trim()); currentCell = '';
        } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell.trim());
            if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== '')) rows.push(currentRow);
            currentRow = []; currentCell = '';
        } else currentCell += char;
    }
    if (currentCell || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); }
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.replace(/^"|"$/g, '').replace(/^\uFEFF/, '').toLowerCase().trim());
    return rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i] || '');
        return obj;
    });
};

const parseSpecs = (str) => {
    if (!str) return {};
    const specs = {};
    const items = str.split(';').map(s => s.trim()).filter(s => s);
    items.forEach(item => {
        let sep = item.indexOf(':');
        if (sep === -1) sep = item.indexOf(' ');
        if (sep === -1) { if(item.length > 0) specs[item] = "Yes"; }
        else {
            const key = item.substring(0, sep).trim();
            const val = item.substring(sep + 1).trim();
            if (key) specs[key] = val;
        }
    });
    return specs;
};

// ✅ UPDATED HELPER: Robust Google Drive Link Converter
const formatImageUrl = (url) => {
    if (!url) return null;

    // Check if it is a Google Drive Link
    if (url.includes('drive.google.com')) {
        // Pattern 1: /file/d/ID/view (Standard "Share" link)
        const matchView = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (matchView && matchView[1]) {
            return `https://drive.google.com/uc?export=download&id=${matchView[1]}`;
        }

        // Pattern 2: open?id=ID (The "Copy Link" format you are using)
        const matchOpen = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (matchOpen && matchOpen[1]) {
            return `https://drive.google.com/uc?export=download&id=${matchOpen[1]}`;
        }
    }
    return url;
};

// BULK UPLOAD ROUTE
router.post('/bulk', authMiddleware, isAdmin, upload.single('file'), async (req, res) => {
    console.log("📂 Received Bulk Upload");
    try {
        if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

        const products = parseCSV(req.file.buffer);
        const results = { success: 0, failed: 0, errors: [] };

        for (const p of products) {
            const rawPrice = p.price ? p.price.toString().replace(/[^0-9.]/g, '') : "";
            const rawStock = p.stock ? p.stock.toString().replace(/[^0-9]/g, '') : "0";

            if (!p.name || !rawPrice) {
                if (Object.values(p).join('').length > 0) {
                    results.failed++;
                    results.errors.push(`Skipped row: ${p.name || 'Unknown'} (Missing Price)`);
                }
                continue;
            }

            try {
                const specs = parseSpecs(p.specifications || "");
                let desc = p.description || "";
                desc = desc.replace(/\\n/g, '\n');
                const cat = p.category ? p.category.toLowerCase().replace(/ /g, '_') : 'uncategorized';

                const product = await db.one(
                    `INSERT INTO products (
                        name, price, stock, category, sub_category,
                        short_description, description, specifications
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                    [
                        p.name, parseFloat(rawPrice), parseInt(rawStock),
                        cat, p.sub_category || '', p.short_description || '', desc, specs
                    ]
                );

                // Handle Images
                if (p.images) {
                    let rawImages = p.images.replace(/\\n/g, '\n');
                    const urls = rawImages.split(/[\n\r\s,;]+/).map(u => u.trim()).filter(u => u.length > 0);

                    for (let i = 0; i < urls.length; i++) {
                        // This now correctly converts your "open?id=" links
                        const directUrl = formatImageUrl(urls[i]);

                        try {
                            console.log(`   ☁️ Uploading Image ${i+1}/${urls.length} for ${p.name}`);
                            const cloudUrl = await storageService.uploadFromUrl(directUrl, 'products');

                            await db.none(
                                'INSERT INTO product_images (product_id, image_url, display_order) VALUES ($1, $2, $3)',
                                [product.id, cloudUrl, i]
                            );

                            if (i === 0) {
                                await db.none('UPDATE products SET image_url = $1 WHERE id = $2', [cloudUrl, product.id]);
                            }
                        } catch (imgErr) {
                            console.error(`   ⚠️ Failed image: ${directUrl}`, imgErr.message);
                        }
                    }
                }

                results.success++;
            } catch (err) {
                console.error(`Row Error (${p.name}):`, err.message);
                results.failed++;
                results.errors.push(`Failed ${p.name}: ${err.message}`);
            }
        }

        res.json({ message: 'Bulk processing complete', results });
    } catch (error) {
        console.error("Bulk Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// PUBLIC ROUTES
// ==========================================

router.get('/', async (req, res) => {
    try {
        const { category, sub_category, search, show_archived } = req.query;
        let query = 'SELECT * FROM products WHERE 1=1';
        let params = [];
        let paramCount = 1;

        if (show_archived !== 'true') query += ` AND (is_archived = false OR is_archived IS NULL)`;

        if (category && category !== 'all') {
            query += ` AND category = $${paramCount}`;
            params.push(category);
            paramCount++;
        }

        if (sub_category && sub_category !== 'all') {
            query += ` AND (description ILIKE $${paramCount} OR name ILIKE $${paramCount} OR sub_category ILIKE $${paramCount})`;
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
            SELECT r.*, COALESCE(u.full_name, 'Anonymous') as user
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
        const reviews = await db.any(`
            SELECT r.*, COALESCE(u.full_name, 'Anonymous') as user, u.avatar_url
            FROM reviews r
                LEFT JOIN users u ON r.user_id = u.id
            WHERE r.product_id = $1
            ORDER BY r.created_at DESC
        `, [req.params.id]);
        res.json(reviews);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/reviews', authMiddleware, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const review = await db.one(
            'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.params.id, req.userId, rating, comment]
        );
        await db.none(`
            UPDATE products SET
                                average_rating = (SELECT AVG(rating) FROM reviews WHERE product_id = $1),
                                review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1)
            WHERE id = $1
        `, [req.params.id]);
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

// ADMIN ROUTES
router.post('/', authMiddleware, isAdmin, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        const { name, description, short_description, price, category, stock, specifications } = req.body;
        let videoUrl = null;

        if (req.files['video']) {
            videoUrl = await storageService.uploadFile(req.files['video'][0], 'products/videos');
        }

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
                if (i === 0) await db.none('UPDATE products SET image_url = $1 WHERE id = $2', [url, product.id]);
            }
        }
        res.status(201).json(product);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', authMiddleware, isAdmin, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        const { name, description, short_description, price, category, stock, specifications, imagesToDelete } = req.body;

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
            if (idsToDelete.length > 0) await db.none('DELETE FROM product_images WHERE id IN ($1:csv)', [idsToDelete]);
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
        if (firstImage) await db.none('UPDATE products SET image_url = $1 WHERE id = $2', [firstImage.image_url, req.params.id]);

        res.json({ message: "Product updated successfully" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', authMiddleware, isAdmin, async (req, res) => {
    try { await db.none('UPDATE products SET is_archived = true WHERE id = $1', [req.params.id]); res.json({ message: 'Archived' }); } catch (error) { res.status(500).json({ error: error.message }); }
});

router.patch('/:id/restore', authMiddleware, isAdmin, async (req, res) => {
    try { await db.none('UPDATE products SET is_archived = false WHERE id = $1', [req.params.id]); res.json({ message: 'Restored' }); } catch (error) { res.status(500).json({ error: error.message }); }
});

export default router;