    import express from 'express';
    import db from '../config/database.js';
    import authMiddleware from '../middleware/auth.js';
    import { emailService } from '../services/email.service.js';


    const router = express.Router();

    /**
     * GET /api/orders
     */
    router.get('/', authMiddleware, async (req, res, next) => {
        try {
            const orders = await db.any(`
                SELECT
                    o.id, o.created_at, o.status,
                    o.total_amount, o.subtotal_amount, o.tax_amount, o.shipping_amount, -- ✅ Added these columns
                    o.shipping_address, o.payment_gateway,
                    COALESCE(json_agg(
                                     json_build_object(
                                             'product_id', oi.product_id,
                                             'quantity', oi.quantity,
                                             'price', oi.price,
                                             'line_total', oi.line_total,
                                             'product_name', p.name,
                                             'product_image', p.image_url
                                     )
                             ) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
                FROM orders o
                         LEFT JOIN order_items oi ON o.id = oi.order_id
                         LEFT JOIN products p ON oi.product_id = p.id
                WHERE o.user_id = $1
                GROUP BY o.id
                ORDER BY o.created_at DESC
            `, [req.userId]);

            res.json({ success: true, data: orders });
        } catch (error) {
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
     * Creates an order AND decrements stock
     */
    router.post('/', authMiddleware, async (req, res, next) => {
        try {
            const { items, shippingAddress, paymentGateway, shippingAmount } = req.body;

            if (!items || !items.length) return res.status(400).json({ error: 'No items in order' });

            // 1. Fetch products to check stock and price
            const productIds = items.map(i => i.product_id);
            const products = await db.many('SELECT id, price, stock, name FROM products WHERE id IN ($1:csv)', [productIds]);

            const productMap = {};
            products.forEach(p => productMap[p.id] = p);

            // 2. Validate Stock & Calculate Totals
            let subtotal = 0;
            const verifiedItems = [];

            for (const item of items) {
                const product = productMap[item.product_id];
                if (!product) throw new Error(`Product not found: ${item.product_id}`);

                // 🔥 Check Stock
                if (product.stock < item.quantity) {
                    return res.status(400).json({ error: `Not enough stock for ${product.name}. Available: ${product.stock}` });
                }

                const quantity = parseInt(item.quantity) || 1;
                const lineTotal = parseFloat(product.price) * quantity;
                subtotal += lineTotal;
                verifiedItems.push({ ...item, price: product.price, quantity, lineTotal });
            }

            const shipping = shippingAmount !== undefined ? parseFloat(shippingAmount) : 50.00;
            const gst = subtotal * 0.18;
            const totalAmount = subtotal + gst + shipping;

            // 3. Create Order & Update Stock in Transaction
            const newOrder = await db.tx(async t => {
                // A. Create Order
                const order = await t.one(
                    `INSERT INTO orders
                     (user_id, subtotal_amount, tax_amount, shipping_amount, total_amount, shipping_address, payment_gateway, status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
                         RETURNING *`,
                    [req.userId, subtotal, gst, shipping, totalAmount, JSON.stringify(shippingAddress), paymentGateway]
                );

                // B. Insert Items & Decrement Stock
                const queries = verifiedItems.map(item => {
                    return [
                        t.none(
                            `INSERT INTO order_items (order_id, product_id, quantity, price, line_total)
                         VALUES ($1, $2, $3, $4, $5)`,
                            [order.id, item.product_id, item.quantity, item.price, item.lineTotal]
                        ),
                        // 🔥 Decrement Stock
                        t.none(
                            `UPDATE products SET stock = stock - $1 WHERE id = $2`,
                            [item.quantity, item.product_id]
                        )
                    ];
                });

                await t.batch(queries.flat()); // Flatten array of arrays
                return order;
            });

            // 4. Send Email (Async)
            db.one('SELECT email, full_name FROM users WHERE id = $1', [req.userId])
                .then(user => emailService.sendOrderConfirmation(user.email, newOrder.id, totalAmount, verifiedItems))
                .catch(err => console.error('Email failed:', err));

            res.status(201).json({ message: 'Order placed successfully', orderId: newOrder.id });
        } catch (error) {
            console.error('Order Error:', error);
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

            // We only send emails for specific statuses to avoid spamming 'processing' updates
            if (['shipped', 'delivered', 'cancelled'].includes(status)) {
                try {
                    // Fetch user details
                    const user = await db.oneOrNone(
                        'SELECT email, full_name FROM users WHERE id = $1',
                        [order.user_id]
                    );

                    if (user) {
                        emailService.sendOrderStatusEmail(
                            user.email,
                            user.full_name,
                            order.id,
                            status
                        ).catch(err => console.error('Status email failed:', err));
                    }
                } catch (emailErr) {
                    console.error('Failed to fetch user for email:', emailErr);
                }
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
     */
    router.get('/admin/all', authMiddleware, async (req, res, next) => {
        try {
            if (req.userRole !== 'admin') return res.status(403).json({ error: 'Access denied' });

            const orders = await db.any(`
                SELECT
                    o.id, o.created_at, o.status,
                    o.total_amount, o.subtotal_amount, o.tax_amount, o.shipping_amount, -- ✅ Added these columns
                    o.shipping_address, o.user_id,
                    u.email as user_email, u.full_name as user_name,
                    COALESCE(json_agg(
                                     json_build_object(
                                             'product_id', oi.product_id,
                                             'quantity', oi.quantity,
                                             'line_total', oi.line_total,
                                             'product', json_build_object(
                                                     'name', p.name,
                                                     'image_url', p.image_url
                                                        )
                                     )
                             ) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
                FROM orders o
                         JOIN users u ON o.user_id = u.id
                         LEFT JOIN order_items oi ON o.id = oi.order_id
                         LEFT JOIN products p ON oi.product_id = p.id
                GROUP BY o.id, u.id
                ORDER BY o.created_at DESC
            `);

            res.json({ success: true, data: orders });
        } catch (error) {
            next(error);
        }
    });

    // ==========================================
    // CUSTOMER ACTIONS (Cancel & Edit Address)
    // ==========================================

    /**
     * POST /api/orders/:id/cancel
     * Cancels an order (and all sibling items in the same checkout group)
     */
    router.post('/:id/cancel', authMiddleware, async (req, res, next) => {
        try {
            const { id } = req.params;
            const userId = req.userId;

            // 1. Check if the order exists and is eligible for cancellation
            const order = await db.oneOrNone(
                'SELECT status, created_at FROM orders WHERE id = $1 AND user_id = $2',
                [id, userId]
            );

            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            const allowCancel = ['pending', 'pending_payment', 'processing'];
            if (!allowCancel.includes(order.status)) {
                return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
            }

            // 2. Cancel ALL items that were bought in the same "second" (same checkout group)
            // We use DATE_TRUNC to match the grouping logic used in your GET route
            await db.none(
                `UPDATE orders 
                 SET status = 'cancelled', updated_at = NOW()
                 WHERE user_id = $1 
                 AND DATE_TRUNC('second', created_at) = DATE_TRUNC('second', $2::timestamp)`,
                [userId, order.created_at]
            );

            res.json({ success: true, message: 'Order cancelled successfully' });
        } catch (error) {
            console.error('Cancel order error:', error);
            next(error);
        }
    });

    /**
     * PUT /api/orders/:id/address
     * Updates shipping address for an order (and all sibling items)
     */
    router.put('/:id/address', authMiddleware, async (req, res, next) => {
        try {
            const { id } = req.params;
            const { address } = req.body;
            const userId = req.userId;

            if (!address) return res.status(400).json({ error: 'Address data required' });

            // 1. Check order status
            const order = await db.oneOrNone(
                'SELECT status, created_at FROM orders WHERE id = $1 AND user_id = $2',
                [id, userId]
            );

            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            const allowEdit = ['pending', 'pending_payment', 'processing'];
            if (!allowEdit.includes(order.status)) {
                return res.status(400).json({ error: 'Cannot update address for shipped orders' });
            }

            // 2. Update address for ALL items in the same checkout group
            await db.none(
                `UPDATE orders 
                 SET shipping_address = $1, updated_at = NOW()
                 WHERE user_id = $2 
                 AND DATE_TRUNC('second', created_at) = DATE_TRUNC('second', $3::timestamp)`,
                [JSON.stringify(address), userId, order.created_at]
            );

            res.json({ success: true, message: 'Address updated successfully' });
        } catch (error) {
            console.error('Update address error:', error);
            next(error);
        }
    });

    export default router;
