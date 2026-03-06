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

// ✅ 160 IQ SEO: Clean Semantic Slugs
const generateUniqueSlug = async (name, ignoreId = null) => {
    let slug = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const checkQuery = ignoreId 
        ? 'SELECT id FROM products WHERE slug = $1 AND id != $2'
        : 'SELECT id FROM products WHERE slug = $1';
    
    const params = ignoreId ? [slug, ignoreId] : [slug];
    
    let exists = await db.oneOrNone(checkQuery, params);
    
    if (exists) {
        let counter = 1;
        let newSlug = `${slug}-${counter}`;
        while (await db.oneOrNone('SELECT id FROM products WHERE slug = $1', [newSlug])) {
            counter++;
            newSlug = `${slug}-${counter}`;
        }
        return newSlug;
    }
    
    return slug;
};

// ✅ FIXED: Robust Admin Middleware (Removed crashing user_roles check)
const isAdmin = async (req, res, next) => {
    try {
        // 1. First check if the token payload already knows they are an admin
        if (req.userRole === 'admin') {
            return next();
        }

        // 2. If not, do a single, safe lookup on the main users table
        const user = await db.oneOrNone('SELECT role FROM users WHERE id = $1', [req.userId]);
        
        if (user && user.role === 'admin') {
            return next();
        } else {
            // Stop crashing the server, just gracefully deny access
            return res.status(403).json({ error: 'Admin access required' });
        }
    } catch (error) {
        console.error("Admin Verify Error:", error);
        res.status(500).json({ error: 'Failed to verify admin privileges' });
    }
};

// Helper function to parse CSV files
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

const formatImageUrl = (url) => {
    if (!url) return null;
    if (url.includes('drive.google.com')) {
        const matchView = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (matchView && matchView[1]) return `https://drive.google.com/uc?export=download&id=${matchView[1]}`;
        const matchOpen = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (matchOpen && matchOpen[1]) return `https://drive.google.com/uc?export=download&id=${matchOpen[1]}`;
    }
    return url;
};

// ==========================================
// SYNCED BULK UPLOAD ROUTE
// ==========================================
router.post('/bulk', authMiddleware, isAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

        const products = parseCSV(req.file.buffer);
        const results = { success: 0, failed: 0, errors: [] };

        for (const p of products) {
            const rawPrice = p.price ? p.price.toString().replace(/[^0-9.]/g, '') : "";
            const rawStock = p.stock ? p.stock.toString().replace(/[^0-9]/g, '') : "0";

            if (!p.name || !rawPrice) continue;

            try {
                const specs = parseSpecs(p.specifications || "");
                // ✅ FIX: Stringify specs to prevent text[] casting crash
                const specsString = JSON.stringify(specs);
                const cat = p.category ? p.category.toLowerCase().replace(/ /g, '_') : 'uncategorized';
                
                const slug = await generateUniqueSlug(p.name);

                const product = await db.one(
                    `INSERT INTO products (
                        name, slug, price, stock, category, sub_category,
                        short_description, description, specifications
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb) RETURNING id`,
                    [p.name, slug, parseFloat(rawPrice), parseInt(rawStock), cat, p.sub_category || '', p.short_description || '', p.description || '', specsString]
                );

                if (p.images) {
                    const urls = p.images.split(/[\n\r\s,;]+/).map(u => u.trim()).filter(Boolean);
                    for (let i = 0; i < urls.length; i++) {
                        const directUrl = formatImageUrl(urls[i]);
                        try {
                            const cloudUrl = await storageService.uploadFromUrl(directUrl, 'products', p.name);
                            await db.none('INSERT INTO product_images (product_id, image_url, display_order) VALUES ($1, $2, $3)', [product.id, cloudUrl, i]);
                            if (i === 0) await db.none('UPDATE products SET image_url = $1 WHERE id = $2', [cloudUrl, product.id]);
                        } catch (imgErr) {
                            console.error(`Failed image for ${p.name}:`, imgErr.message);
                        }
                    }
                }
                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push(`Failed ${p.name}: ${err.message}`);
            }
        }
        res.json({ message: 'Bulk processing complete', results });
    } catch (error) {
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
        if (search) {
            query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }
        query += ' ORDER BY created_at DESC';

        const products = await db.any(query, params);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const param = req.params.id;
        
        // ✅ 160 IQ ROUTING: Determine if param is UUID or Slug to prevent DB casting crashes
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const isUUID = uuidRegex.test(param);

        const query = isUUID 
            ? 'SELECT * FROM products WHERE id = $1' 
            : 'SELECT * FROM products WHERE slug = $1';

        const product = await db.oneOrNone(query, [param]);
        
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const images = await db.any('SELECT * FROM product_images WHERE product_id = $1 ORDER BY display_order ASC', [product.id]);
        product.product_images = images;

        const reviews = await db.any(`
            SELECT r.*, COALESCE(u.full_name, 'Anonymous') as user
            FROM reviews r LEFT JOIN users u ON r.user_id = u.id
            WHERE r.product_id = $1 ORDER BY r.created_at DESC
        `, [product.id]);
        product.reviews = reviews;

        res.json(product);
    } catch (error) {
        console.error("Fetch Product Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// CUSTOMER ACTIONS (LIKES & REVIEWS)
// ==========================================
router.post('/:id/like', authMiddleware, async (req, res) => {
    try {
        await db.none('UPDATE products SET likes_count = likes_count + 1 WHERE id::text = $1 OR slug = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id/like', authMiddleware, async (req, res) => {
    try {
        await db.none('UPDATE products SET likes_count = GREATEST(likes_count - 1, 0) WHERE id::text = $1 OR slug = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/:id/reviews', authMiddleware, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const product = await db.oneOrNone('SELECT id FROM products WHERE id::text = $1 OR slug = $1', [req.params.id]);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        
        await db.none('INSERT INTO reviews (product_id, user_id, rating, comment) VALUES ($1, $2, $3, $4)', [product.id, req.userId, rating, comment]);
        const stats = await db.one('SELECT AVG(rating) as avg, COUNT(id) as count FROM reviews WHERE product_id = $1', [product.id]);
        await db.none('UPDATE products SET average_rating = $1, review_count = $2 WHERE id = $3', [stats.avg || 0, stats.count, product.id]);
        
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});


// ==========================================
// ADMIN ACTIONS
// ==========================================

router.post('/', authMiddleware, isAdmin, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        const { name, description, short_description, price, category, stock, specifications, is_archived } = req.body;
        
        // ✅ FIX: Stringify specifications to prevent pg-promise from formatting arrays as text[]
        let specsToSave = '{}';
        try {
            if (specifications) {
                const parsed = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
                specsToSave = JSON.stringify(parsed);
            }
        } catch(e) {}

        const slug = await generateUniqueSlug(name);

        const product = await db.one(
            `INSERT INTO products (name, slug, description, short_description, price, category, stock, specifications, is_archived)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) RETURNING *`,
            [name, slug, description, short_description, price, category, stock, specsToSave, is_archived === 'true']
        );

        if (req.files && req.files['images']) {
            for (let i = 0; i < req.files['images'].length; i++) {
                const url = await storageService.uploadFile(req.files['images'][i], 'products');
                await db.none('INSERT INTO product_images (product_id, image_url, display_order) VALUES ($1, $2, $3)', [product.id, url, i]);
                if (i === 0) await db.none('UPDATE products SET image_url = $1 WHERE id = $2', [url, product.id]);
            }
        }
        res.status(201).json(product);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', authMiddleware, isAdmin, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
        const { name, description, short_description, price, category, stock, specifications, imagesToDelete, is_archived } = req.body;

        // ✅ FIX: Stringify specifications to prevent pg-promise from formatting arrays as text[]
        let specsToSave = '{}';
        try {
            if (specifications) {
                const parsed = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
                specsToSave = JSON.stringify(parsed);
            }
        } catch(e) {}

        const existing = await db.one('SELECT name, slug FROM products WHERE id = $1', [req.params.id]);
        let slug = existing.slug;
        
        if (!slug || name !== existing.name) {
            slug = await generateUniqueSlug(name, req.params.id);
        }

        await db.none(
            `UPDATE products
             SET name=$1, slug=$2, description=$3, short_description=$4, price=$5, category=$6, stock=$7, specifications=$8::jsonb, is_archived=$9, updated_at=NOW()
             WHERE id=$10`,
            [name, slug, description, short_description, price, category, stock, specsToSave, is_archived === 'true', req.params.id]
        );

        if (imagesToDelete) {
            const idsToDelete = JSON.parse(imagesToDelete);
            if (idsToDelete.length > 0) await db.none('DELETE FROM product_images WHERE id IN ($1:csv)', [idsToDelete]);
        }

        if (req.files && req.files['images']) {
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
    try {
        if (req.query.permanent === 'true') {
            await db.none('DELETE FROM product_images WHERE product_id = $1', [req.params.id]);
            await db.none('DELETE FROM reviews WHERE product_id = $1', [req.params.id]);
            await db.none('DELETE FROM products WHERE id = $1', [req.params.id]);
            res.json({ message: 'Deleted permanently' });
        } else {
            await db.none('UPDATE products SET is_archived = true WHERE id = $1', [req.params.id]);
            res.json({ message: 'Archived' });
        }
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.patch('/:id/restore', authMiddleware, isAdmin, async (req, res) => {
    try { await db.none('UPDATE products SET is_archived = false WHERE id = $1', [req.params.id]); res.json({ message: 'Restored' }); } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==========================================
// ✅ 160 IQ: AUTOMATED REVIEW SEEDER
// ==========================================
router.post('/seed-reviews', authMiddleware, isAdmin, async (req, res) => {
    try {
        // 1. Create Authentic-Looking Dummy Users
        const dummyNames = [
            'Rahul Verma', 'Sneha Iyer', 'Kunal Kapoor', 'Aditi Desai', 
            'Rakesh Singh', 'Pooja Nair', 'Siddharth Rao', 'Neha Gupta', 
            'Vikram Patel', 'Priya Sharma'
        ];
        const userIds = [];
        
        for (const name of dummyNames) {
            const email = `${name.toLowerCase().replace(' ', '.')}@verified.local`;
            let u = await db.oneOrNone('SELECT id FROM users WHERE email = $1', [email]);
            if (!u) {
                u = await db.one(
                    'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id', 
                    [email, 'dummy_hash', name, 'customer']
                );
            }
            userIds.push(u.id);
        }

        // 2. Fetch all active products
        const products = await db.any('SELECT id, category FROM products');

        // 3. Realistic Context-Aware Review Banks
        const printerReviews = [
            { rating: 5, comment: "Incredible print quality right out of the box. Setup took less than 30 minutes! Very happy with ProtoDesign's service." },
            { rating: 4, comment: "Very sturdy build. The UI is responsive and prints are highly accurate. Good value for money." },
            { rating: 5, comment: "I've used many machines, but this one takes the crown for reliability. Highly recommend it to anyone starting out." },
            { rating: 5, comment: "Silent printing and amazing bed adhesion. The delivery was incredibly fast." },
            { rating: 4, comment: "Solid machine. The packaging was excellent and arrived in perfect condition." }
        ];

        const materialReviews = [
            { rating: 5, comment: "Fantastic material! No stringing, great layer adhesion, and the color is exactly as shown." },
            { rating: 5, comment: "Prints flawlessly on my setup. Will definitely be buying my supplies from here from now on." },
            { rating: 4, comment: "Good quality, doesn't clog the nozzle. Very satisfied with the final finish of my prints." },
            { rating: 5, comment: "Highly detailed prints and very little shrinkage. Highly recommend this brand." }
        ];

        const generalReviews = [
            { rating: 5, comment: "Exactly as described. Fast shipping and excellent quality." },
            { rating: 4, comment: "Very happy with my purchase. Works perfectly as expected." },
            { rating: 5, comment: "Premium quality! You can trust this store, their customer support is also great." }
        ];

        // 4. Inject Reviews Safely
        let addedCount = 0;
        for (const p of products) {
            // Generate 2 to 4 reviews per product
            const numReviews = Math.floor(Math.random() * 3) + 2; 
            const shuffledUsers = userIds.sort(() => 0.5 - Math.random()).slice(0, numReviews);

            let reviewBank = generalReviews;
            if (p.category === '3d_printer') reviewBank = printerReviews;
            else if (['filament', 'resin'].includes(p.category)) reviewBank = materialReviews;

            for(const uid of shuffledUsers) {
                const r = reviewBank[Math.floor(Math.random() * reviewBank.length)];
                
                // Randomize the date (between 1 and 45 days ago) to make it look organic
                const daysAgo = Math.floor(Math.random() * 45) + 1;
                const jitteredDate = new Date();
                jitteredDate.setDate(jitteredDate.getDate() - daysAgo);

                const existing = await db.oneOrNone('SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2', [p.id, uid]);
                if (!existing) {
                    await db.none('INSERT INTO reviews (product_id, user_id, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5)', [p.id, uid, r.rating, r.comment, jitteredDate]);
                    addedCount++;
                }
            }

            // 5. Instantly Update Product Averages
            const stats = await db.one('SELECT AVG(rating) as avg, COUNT(id) as count FROM reviews WHERE product_id = $1', [p.id]);
            await db.none('UPDATE products SET average_rating = $1, review_count = $2 WHERE id = $3', [stats.avg || 0, stats.count, p.id]);
        }

        res.json({ success: true, message: `Successfully injected ${addedCount} authentic reviews across your store.` });
    } catch (error) {
        console.error("Seeder Error:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
