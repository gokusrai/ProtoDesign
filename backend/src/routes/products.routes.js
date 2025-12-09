import express from 'express';
import db from '../config/database.js';
import authMiddleware from '../middleware/auth.js';
import multer from 'multer';

const router = express.Router();

// Multer configuration for multiple images (up to 7)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB per image
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files allowed'), false);
        }
    },
});



// ===== LIKE ENDPOINTS =====

// Helper function
async function getLikesCount(productId) {
    const result = await db.oneOrNone(
        'SELECT COALESCE(likes_count, 0) as likes_count FROM products WHERE id = $1',
        [productId]
    );
    return parseInt(result?.likes_count) || 0;
}

// 1. GET /api/products/:id/likes - Check if liked + get count
// ===== SAFER LIKE ROUTES =====
router.get('/:id/likes', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;

        // ✅ SAFE: Check if userId exists
        if (!req.userId) {
            return res.json({ success: true, isLiked: false, likesCount: 0 });
        }

        const userId = req.userId;

        // ✅ SAFE: Try to check like (ignore if table missing)
        let isLiked = false;
        try {
            const like = await db.oneOrNone(
                'SELECT id FROM product_likes WHERE user_id = $1 AND product_id = $2',
                [userId, id]
            );
            isLiked = !!like;
        } catch (likeError) {
            console.log('Likes table not ready:', likeError.message);
        }

        // ✅ SAFE: Get likes count (ignore if column missing)
        let likesCount = 0;
        try {
            const result = await db.oneOrNone(
                'SELECT COALESCE(likes_count, 0) as likes_count FROM products WHERE id = $1',
                [id]
            );
            likesCount = parseInt(result?.likes_count) || 0;
        } catch (countError) {
            console.log('likes_count column not ready:', countError.message);
        }

        res.json({ success: true, isLiked, likesCount });
    } catch (error) {
        console.error('GET /:id/likes error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 🔥 BULLETPROOF POST LIKE ROUTE - Replace your POST route
router.post('/:id/like', authMiddleware, async (req, res) => {
    console.log('🔥 LIKE POST:', req.params.id, 'userId:', req.userId);

    try {
        const { id } = req.params;

        // 1. Validate inputs
        if (!req.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!id) {
            return res.status(400).json({ error: 'No product ID' });
        }

        // 2. Check product exists
        const productCheck = await db.oneOrNone('SELECT id FROM products WHERE id = $1', [id]);
        if (!productCheck) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // 3. Check if already liked
        let alreadyLiked = false;
        try {
            const existing = await db.oneOrNone(
                'SELECT 1 FROM product_likes WHERE user_id = $1 AND product_id = $2',
                [req.userId, id]
            );
            alreadyLiked = !!existing;
        } catch (e) {
            console.log('Likes table check failed (normal first time):', e.message);
        }

        if (alreadyLiked) {
            return res.status(400).json({ error: 'Already liked' });
        }

        // 4. Atomic transaction
        await db.tx(async (t) => {
            try {
                // Insert like
                await t.none(
                    `INSERT INTO product_likes (user_id, product_id, created_at) 
                     VALUES ($1, $2, CURRENT_TIMESTAMP)`,
                    [req.userId, id]
                );

                // Update count
                await t.none(
                    `UPDATE products 
                     SET likes_count = COALESCE(likes_count, 0) + 1 
                     WHERE id = $1`,
                    [id]
                );
            } catch (txError) {
                throw txError;
            }
        });

        // 5. Return success
        const finalCount = await getLikesCount(id);
        console.log('✅ LIKE SUCCESS:', finalCount);

        res.json({
            success: true,
            isLiked: true,
            likesCount: finalCount
        });

    } catch (error) {
        console.error('❌ LIKE ERROR FULL:', error);
        res.status(500).json({
            error: 'Like failed',
            details: error.message
        });
    }
});


// 3. DELETE /api/products/:id/like - Unlike product
router.delete('/:id/like', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        const result = await db.result(
            'DELETE FROM product_likes WHERE user_id = $1 AND product_id = $2 RETURNING 1',
            [userId, id]
        );

        if (result.rowCount > 0) {
            // Decrement counter (never go below 0)
            await db.none(
                'UPDATE products SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1',
                [id]
            );
        }

        res.json({
            success: true,
            isLiked: false,
            likesCount: await getLikesCount(id)
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/products
 * Returns all products with first image as thumbnail
 */
// GET /api/products - Include ALL images for carousel
router.get('/', async (req, res, next) => {
    try {
        const { category, search, sort } = req.query;

        const products = await db.manyOrNone(`
      SELECT 
        p.id, p.name, p.description, p.price, p.stock, p.category,p.likes_count, p.created_at,
        COALESCE(
          pi1.image_url,
          CASE WHEN pi1.image_data IS NOT NULL 
            THEN 'data:image/jpeg;base64,' || encode(pi1.image_data, 'base64')
            ELSE NULL 
          END
        ) as image_url,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'image_url', pi.image_url,
              'image_data', CASE WHEN pi.image_data IS NOT NULL 
                THEN 'data:image/jpeg;base64,' || encode(pi.image_data, 'base64')
                ELSE NULL 
              END,
              'display_order', pi.display_order
            ) ORDER BY pi.display_order
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::json
        ) as product_images
      FROM products p
      LEFT JOIN LATERAL (
        SELECT * FROM product_images 
        WHERE product_id = p.id 
        ORDER BY display_order ASC 
        LIMIT 1
      ) pi1 ON true
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE 1=1
      ${category ? 'AND p.category = $1' : ''}
      ${search ? 'AND (p.name ILIKE $2 OR p.description ILIKE $2)' : ''}
      GROUP BY p.id, pi1.id, pi1.image_url, pi1.image_data
      ORDER BY p.created_at DESC
    `, [category, `%${search}%`].filter(Boolean));

        res.json({ success: true, count: products.length, data: products });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/products/:id
 * Returns single product with ALL images
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const product = await db.oneOrNone(
            `
                SELECT p.id, p.name, p.description, p.price, p.stock, p.category, p.created_at,
                       COALESCE(
                               pi1.image_url,
                               CASE WHEN pi1.image_data IS NOT NULL
                                        THEN 'data:image/jpeg;base64,' || encode(pi1.image_data, 'base64')
                                    ELSE NULL
                                   END
                       ) as image_url,
                       COALESCE(
                               json_agg(
                                       json_build_object(
                                               'id', pi.id,
                                               'image_url', pi.image_url,
                                               'image_data', CASE WHEN pi.image_data IS NOT NULL
                                                                      THEN 'data:image/jpeg;base64,' || encode(pi.image_data, 'base64')
                                                                  ELSE NULL
                                                   END,
                                               'display_order', pi.display_order
                                       ) ORDER BY pi.display_order
                               ) FILTER (WHERE pi.id IS NOT NULL),
                               '[]'::json
                       ) as product_images
                FROM products p
                         LEFT JOIN LATERAL (
                    SELECT * FROM product_images
                    WHERE product_id = p.id
                    ORDER BY display_order ASC
                        LIMIT 1
      ) pi1 ON true
                    LEFT JOIN product_images pi ON p.id = pi.product_id
                WHERE p.id = $1
                GROUP BY p.id, pi1.id, pi1.image_url, pi1.image_data
            `,
            [id]
        );

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/products
 * Create product with multiple images
 */
router.post(
    '/',
    authMiddleware,
    upload.array('images', 7),
    async (req, res, next) => {
        try {
            // Check admin role
            if (req.userRole !== 'admin') {
                return res
                    .status(403)
                    .json({ error: 'Only admins can create products' });
            }

            const { name, description, price, category, stock } = req.body;

            // Validate required fields
            if (!name || !price) {
                return res
                    .status(400)
                    .json({ error: 'Name and price are required' });
            }

            // 1. Create product
            const product = await db.one(
                `INSERT INTO products (name, description, price, category, stock, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                     RETURNING id, name, description, price, stock, category, created_at`,
                [
                    name,
                    description || null,
                    parseFloat(price),
                    category || '3d_printer',
                    parseInt(stock) || 0,
                ]
            );

            // 2. Insert images into product_images table
            if (req.files && req.files.length > 0) {
                const imageInserts = req.files.map((file, index) =>
                    db.none(
                        `INSERT INTO product_images (product_id, image_data, display_order, created_at, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [product.id, file.buffer, index]
                    )
                );
                await Promise.all(imageInserts);
            }

            res.status(201).json({
                success: true,
                message: `Product created successfully with ${req.files?.length || 0} images`,
                data: product,
            });
        } catch (error) {
            console.error('POST /products error:', error);
            next(error);
        }
    }
);

/**
 * PUT /api/products/:id
 * Update product and replace all images
 */
router.put(
    '/:id',
    authMiddleware,
    upload.array('images', 7),
    async (req, res, next) => {
        try {
            // Check admin role
            if (req.userRole !== 'admin') {
                return res
                    .status(403)
                    .json({ error: 'Only admins can update products' });
            }

            const { id } = req.params;
            const { name, description, price, category, stock } = req.body;

            // Build update query dynamically
            const updates = [];
            const params = [];
            let paramCount = 1;

            if (name !== undefined && name !== '') {
                updates.push(`name = $${paramCount}`);
                params.push(name);
                paramCount++;
            }
            if (description !== undefined && description !== '') {
                updates.push(`description = $${paramCount}`);
                params.push(description);
                paramCount++;
            }
            if (price !== undefined && price !== '') {
                updates.push(`price = $${paramCount}`);
                params.push(parseFloat(price));
                paramCount++;
            }
            if (category !== undefined && category !== '') {
                updates.push(`category = $${paramCount}`);
                params.push(category);
                paramCount++;
            }
            if (stock !== undefined && stock !== '') {
                updates.push(`stock = $${paramCount}`);
                params.push(parseInt(stock));
                paramCount++;
            }

            // Always update updated_at
            updates.push(`updated_at = CURRENT_TIMESTAMP`);

            if (updates.length === 0 && !req.files?.length) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            params.push(id);

            // ✅ NEW: Delete removed images
            if (req.body.imagesToDelete) {
                try {
                    const imagesToDelete = JSON.parse(req.body.imagesToDelete);
                    if (Array.isArray(imagesToDelete) && imagesToDelete.length > 0) {
                        await db.none(
                            'DELETE FROM product_images WHERE id = ANY($1::uuid[]) AND product_id = $2',
                            [imagesToDelete, id]
                        );
                    }
                } catch (e) {
                    console.error('Error deleting images:', e);
                }
            }


            // 1. Update product (only if there are field updates)
            if (updates.length > 1 || (updates.length === 1 && !updates[0].includes('updated_at'))) {
                const product = await db.oneOrNone(
                    `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, name, description, price, stock, category, created_at`,
                    params
                );

                if (!product) {
                    return res.status(404).json({ error: 'Product not found' });
                }
            } else {
                // Check if product exists
                const exists = await db.oneOrNone(
                    `SELECT id FROM products WHERE id = $1`,
                    [id]
                );

                if (!exists) {
                    return res.status(404).json({ error: 'Product not found' });
                }
            }

            // 2. Delete old images if new images are provided
            // In your products.routes.js PUT route
            if (req.files && req.files.length > 0) {
                // ✅ FIX: Don't delete old images! Just append new ones
                // OLD CODE (deletes):
                // await db.none('DELETE FROM product_images WHERE product_id = $1', [id]);

                // NEW CODE (keeps old, adds new):
                const imageInserts = req.files.map((file, index) =>
                    db.none(
                        `INSERT INTO product_images (product_id, image_data, display_order, created_at, updated_at)
                         VALUES ($1, $2, (SELECT COALESCE(MAX(display_order), -1) + 1 FROM product_images WHERE product_id = $1), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [id, file.buffer]
                    )
                );
                await Promise.all(imageInserts);
            }


            res.json({
                success: true,
                message: `Product updated successfully${req.files?.length ? ` with ${req.files.length} images` : ''}`,
                data: { id },
            });
        } catch (error) {
            console.error('PUT /products/:id error:', error);
            next(error);
        }
    }
);

/**
 * DELETE /api/products/:id
 * Delete product (cascades to delete images)
 */
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        // Check admin role
        if (req.userRole !== 'admin') {
            return res
                .status(403)
                .json({ error: 'Only admins can delete products' });
        }

        const { id } = req.params;

        // Delete product (ON DELETE CASCADE will delete images)
        const product = await db.oneOrNone(
            'DELETE FROM products WHERE id = $1 RETURNING id, name',
            [id]
        );

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({
            success: true,
            message: 'Product deleted successfully',
            data: product,
        });
    } catch (error) {
        console.error('DELETE /products/:id error:', error);
        next(error);
    }
});



export default router;