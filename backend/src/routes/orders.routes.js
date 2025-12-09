import express from 'express';
import db from '../config/database.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// GET /api/orders
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const orders = await db.manyOrNone(
            `
                WITH base AS (
                    SELECT
                        o.id,
                        o.user_id,
                        o.product_id,
                        o.quantity,
                        CAST(o.total_amount AS NUMERIC) AS total_amount,
                        o.status,
                        o.created_at,
                        DATE_TRUNC('second', o.created_at) AS order_group,
                        p.id   AS product_id_real,
                        p.name AS product_name,
                        CAST(p.price AS NUMERIC) AS product_price,
                        p.image_data,
                        p.image_url
                    FROM orders o
                             LEFT JOIN products p ON o.product_id = p.id
                    WHERE o.user_id = $1
                )
                SELECT
                    MIN(id::text) AS id,                              -- pick one id per group
                    MIN(created_at) AS created_at,
                    SUM(total_amount) AS total_amount,
                    SUM(quantity) AS total_quantity,
                    MAX(status) AS status,
                    order_group,
                    json_agg(
                            json_build_object(
                                    'product_id', product_id_real,
                                    'quantity', quantity,
                                    'line_total', total_amount,
                                    'product', json_build_object(
                                            'id', product_id_real,
                                            'name', product_name,
                                            'price', product_price,
                                            'image_url',
                                            CASE
                                                WHEN image_data IS NOT NULL
                                                    THEN 'data:image/jpeg;base64,' || encode(image_data, 'base64')
                                                ELSE image_url
                                                END
                                               )
                            )
                    ) AS items
                FROM base
                GROUP BY order_group
                ORDER BY MIN(created_at) DESC
            `,
            [req.userId]
        );

        res.json({ success: true, count: orders.length, data: orders });
    } catch (error) {
        console.error('Fetch orders error:', error);
        next(error);
    }
});




/**
 * GET /api/orders/:id
 * Get single order by ID (requires auth, must be user's own order)
 */
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;

        const order = await db.oneOrNone(
            `SELECT * FROM orders
             WHERE id = $1 AND user_id = $2`,
            [id, req.userId]
        );

        if (!order) {
            return res.status(404).json({
                error: 'Order not found'
            });
        }

        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/orders
 * Create ONE order with MULTIPLE items (instead of separate orders per item)
 */
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { items, totalAmount, shippingAddress, paymentGateway } = req.body;

        // Validation
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: 'Items array is required and must not be empty'
            });
        }

        if (!totalAmount || totalAmount <= 0) {
            return res.status(400).json({
                error: 'Valid total amount is required'
            });
        }

        // Calculate price per item from product data if not provided
        const itemsWithPrices = await Promise.all(
            items.map(async (item) => {
                if (item.price) return item;

                // Fetch price from products table
                const product = await db.oneOrNone(
                    'SELECT price FROM products WHERE id = $1',
                    [item.product_id]
                );

                return {
                    ...item,
                    price: product?.price || 0
                };
            })
        );

        // ✅ Create ONE order per item (they will be grouped by timestamp in GET)
        const createdOrders = [];

        for (const item of itemsWithPrices) {
            const lineTotal = (item.price || 0) * (item.quantity || 1);

            const order = await db.one(
                `INSERT INTO orders
                 (user_id, product_id, quantity, total_amount, shipping_address, payment_gateway, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                     RETURNING *`,
                [
                    req.userId,
                    item.product_id || null,
                    item.quantity || 1,
                    lineTotal,
                    JSON.stringify(shippingAddress || {}),
                    paymentGateway || 'pending',
                    'pending'
                ]
            );

            createdOrders.push(order);
        }

        res.status(201).json({
            message: 'Orders created successfully',
            count: createdOrders.length,
            totalAmount,
            data: createdOrders
        });
    } catch (error) {
        console.error('Order creation error:', error);
        next(error);
    }
});

/**
 * PUT /api/orders/:id
 * Update order status (admin only)
 */
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        // Check if user is admin
        if (req.userRole !== 'admin') {
            return res.status(403).json({
                error: 'Only admins can update orders'
            });
        }

        const { id } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = [
            'pending',
            'pending_payment',
            'processing',
            'shipped',
            'delivered',
            'completed',
            'cancelled'
        ];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Update order
        const order = await db.oneOrNone(
            `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
            [status, id]
        );

        if (!order) {
            return res.status(404).json({
                error: 'Order not found'
            });
        }

        res.json({
            message: 'Order updated successfully',
            data: order
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/orders/admin/all
 * Get all orders (admin only) - grouped by timestamp
 */
// GET /api/orders/admin/all
router.get('/admin/all', authMiddleware, async (req, res, next) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Only admins can view all orders' });
        }

        const orders = await db.manyOrNone(
            `
                WITH base AS (
                    SELECT
                        o.id,
                        o.user_id,
                        o.product_id,
                        o.quantity,
                        CAST(o.total_amount AS NUMERIC) AS total_amount,
                        o.status,
                        o.created_at,
                        DATE_TRUNC('second', o.created_at) AS order_group,
                        p.id   AS product_id_real,
                        p.name AS product_name,
                        CAST(p.price AS NUMERIC) AS product_price,
                        p.image_data,
                        p.image_url
                    FROM orders o
                             LEFT JOIN products p ON o.product_id = p.id
                )
                SELECT
                    MIN(id::text) AS id,
                    MIN(created_at) AS created_at,
                    user_id,
                    SUM(total_amount) AS total_amount,
                    SUM(quantity) AS total_quantity,
                    MAX(status) AS status,
                    order_group,
                    json_agg(
                            json_build_object(
                                    'product_id', product_id_real,
                                    'quantity', quantity,
                                    'line_total', total_amount,
                                    'product', json_build_object(
                                            'id', product_id_real,
                                            'name', product_name,
                                            'price', product_price,
                                            'image_url',
                                            CASE
                                                WHEN image_data IS NOT NULL
                                                    THEN 'data:image/jpeg;base64,' || encode(image_data, 'base64')
                                                ELSE image_url
                                                END
                                               )
                            )
                    ) AS items
                FROM base
                GROUP BY order_group, user_id
                ORDER BY MIN(created_at) DESC
            `
        );

        res.json({ success: true, count: orders.length, data: orders });
    } catch (error) {
        console.error('Fetch admin orders error:', error);
        next(error);
    }
});


export default router;
