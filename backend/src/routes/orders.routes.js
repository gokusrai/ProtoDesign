import express from 'express';
import db from '../config/database.js';
import authMiddleware from '../middleware/auth.js';
import { emailService } from '../services/email.service.js';
import { phonePeService } from '../services/phonepe.service.js';
const router = express.Router();

// ==========================================
// 🚨 ADMIN ROUTE (MUST BE FIRST)
// ==========================================
router.get('/admin/all', authMiddleware, async (req, res, next) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const orders = await db.any(`
            SELECT
                o.id, o.created_at, o.status,
                o.total_amount, o.subtotal_amount, o.tax_amount, o.shipping_amount,
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
// STANDARD ROUTES
// ==========================================

/**
 * GET /api/orders
 * Get logged-in user's orders
 */
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const orders = await db.any(`
            SELECT
                o.id, o.created_at, o.status,
                o.total_amount, o.subtotal_amount, o.tax_amount, o.shipping_amount,
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

        const updatedOrders = await Promise.all(orders.map(async (order) => {
            if (order.status === 'pending' && order.payment_gateway === 'phonepe') {
                try {
                    const statusData = await phonePeService.verifyPaymentStatus(order.id);
                    const state = statusData.state || (statusData.data && statusData.data.state);
                    const code = statusData.code || statusData.responseCode;

                    if (code === 'PAYMENT_SUCCESS' || state === 'COMPLETED' || state === 'SUCCESS') {
                        await db.none(
                            "UPDATE orders SET status = 'processing', payment_status = 'paid', updated_at = NOW() WHERE id = $1",
                            [order.id]
                        );
                        order.status = 'processing';
                    }
                    else if (
                        code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED' ||
                        code === 'PAYMENT_CANCELLED' || state === 'FAILED' ||
                        state === 'CANCELLED' || state === 'DECLINED'
                    ) {
                        await db.none(
                            "UPDATE orders SET status = 'cancelled', payment_status = 'failed', updated_at = NOW() WHERE id = $1",
                            [order.id]
                        );
                        order.status = 'cancelled';
                    }
                } catch (err) {
                    console.error(`Auto-verify failed for ${order.id}:`, err.message);
                    if (err.response) {
                        const errCode = err.response.status;
                        if (errCode === 404 || errCode === 400) {
                            await db.none("UPDATE orders SET status = 'cancelled' WHERE id = $1", [order.id]);
                            order.status = 'cancelled';
                        }
                    } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
                        await db.none("UPDATE orders SET status = 'cancelled' WHERE id = $1", [order.id]);
                        order.status = 'cancelled';
                    } else {
                        const orderAge = Date.now() - new Date(order.created_at).getTime();
                        if (orderAge > 15 * 60 * 1000) {
                            await db.none("UPDATE orders SET status = 'cancelled' WHERE id = $1", [order.id]);
                            order.status = 'cancelled';
                        }
                    }
                }
            }
            return order;
        }));

        res.json({ success: true, data: updatedOrders });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/orders/:id
 */
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = await db.oneOrNone(
            `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
            [id, req.userId]
        );
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: true, data: order });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/orders
 * CREATION WITH DYNAMIC SHIPPING & PRICING ENFORCEMENT
 */
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: 'Request body is empty.' });
        }

        const { items, shippingAddress, paymentGateway } = req.body;
        if (!items || !items.length) return res.status(400).json({ error: 'No items in order' });

        // 1. Fetch Product details from DB for security and category check
        const productIds = items.map(i => i.product_id);
        const products = await db.many('SELECT id, price, stock, name, category FROM products WHERE id IN ($1:csv)', [productIds]);
        
        const productMap = {};
        products.forEach(p => productMap[p.id] = p);

        // 2. ENFORCE BUSINESS RULES (Recalculate logic based on DB verified values)
        const hasPrinter = products.some(p => p.category === '3d_printer');
        
        let shippingAmount = 0.00;
        if (!hasPrinter) {
            shippingAmount = (paymentGateway === 'cod') ? 300.00 : 199.00;
        }

        let subtotal = 0;
        const verifiedItems = [];

        for (const item of items) {
            const product = productMap[item.product_id];
            if (!product) throw new Error(`Product not found: ${item.product_id}`);
            if (product.stock < item.quantity) {
                return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
            }
            const quantity = parseInt(item.quantity) || 1;
            const lineTotal = parseFloat(product.price) * quantity;
            subtotal += lineTotal;
            verifiedItems.push({ ...item, price: product.price, quantity, lineTotal });
        }

        // ✅ SECURITY: Verify COD eligibility on the server side
        if (paymentGateway === 'cod') {
            if (hasPrinter) {
                return res.status(400).json({ error: 'Cash on Delivery is not available for orders containing 3D Printers' });
            }
            if (subtotal >= 999) {
                return res.status(400).json({ error: 'Cash on Delivery is only available for orders below ₹999' });
            }
        }

        const gst = subtotal * 0.18;
        const totalAmount = subtotal + gst + shippingAmount;

        const newOrder = await db.tx(async t => {
            const order = await t.one(
                `INSERT INTO orders
                 (user_id, subtotal_amount, tax_amount, shipping_amount, total_amount, shipping_address, payment_gateway, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
                     RETURNING *`,
                [req.userId, subtotal, gst, shippingAmount, totalAmount, JSON.stringify(shippingAddress), paymentGateway]
            );

            const queries = verifiedItems.map(item => {
                return [
                    t.none(
                        `INSERT INTO order_items (order_id, product_id, quantity, price, line_total)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [order.id, item.product_id, item.quantity, item.price, item.lineTotal]
                    ),
                    t.none(`UPDATE products SET stock = stock - $1 WHERE id = $2`, [item.quantity, item.product_id])
                ];
            });

            await t.batch(queries.flat());
            return order;
        });

        // 3. Initiate Payment or Confirm COD
        if (paymentGateway === 'phonepe' || paymentGateway === 'PHONEPE') {
            try {
                const redirectUrl = await phonePeService.initiatePayment(
                    newOrder.id,
                    totalAmount,
                    req.userId,
                    shippingAddress.phone || '9999999999'
                );
                return res.status(201).json({ success: true, orderId: newOrder.id, redirectUrl });
            } catch (err) {
                return res.status(400).json({ success: false, error: "Payment failed: " + err.message });
            }
        }

        // Handle COD Email/Confirmation
        db.oneOrNone('SELECT email, full_name FROM users WHERE id = $1', [req.userId])
            .then(async (user) => {
                if (user) {
                    await emailService.sendOrderConfirmation(user.email, newOrder.id, totalAmount, verifiedItems);
                }
            });

        res.status(201).json({ message: 'Order placed successfully', orderId: newOrder.id });
    } catch (error) {
        console.error('Order Error:', error);
        next(error);
    }
});

/**
 * POST /api/orders/payment/callback
 */
router.post('/payment/callback', async (req, res) => {
    try {
        let notification = req.body;
        if (req.body.response) {
            const decoded = Buffer.from(req.body.response, 'base64').toString('utf-8');
            notification = JSON.parse(decoded);
        }

        const code = notification.code;
        const data = notification.data || {};
        const merchantOrderId = data.merchantOrderId || data.merchantTransactionId || notification.orderId;
        const state = data.state || notification.state;

        if (!merchantOrderId) return res.status(400).json({ error: "Missing Order ID" });

        if (code === 'PAYMENT_SUCCESS' || state === 'COMPLETED' || state === 'SUCCESS') {
            await db.none(`UPDATE orders SET status = 'processing', payment_status = 'paid', updated_at = NOW() WHERE id = $1`, [merchantOrderId]);
        }
        else if (
            code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED' ||
            code === 'PAYMENT_CANCELLED' || state === 'FAILED' ||
            state === 'CANCELLED' || state === 'DECLINED'
        ) {
            await db.none(`UPDATE orders SET status = 'cancelled', payment_status = 'failed', updated_at = NOW() WHERE id = $1`, [merchantOrderId]);
        }
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Callback Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * PUT /api/orders/:id (Admin only)
 */
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Only admins can update orders' });
        }
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ['pending', 'pending_payment', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status` });
        }

        const order = await db.oneOrNone(`UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`, [status, id]);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (['shipped', 'delivered', 'cancelled'].includes(status)) {
            const user = await db.oneOrNone('SELECT email, full_name FROM users WHERE id = $1', [order.user_id]);
            if (user) {
                emailService.sendOrderStatusEmail(user.email, user.full_name, order.id, status)
                    .catch(err => console.error('Status email failed:', err));
            }
        }
        res.json({ message: 'Order updated successfully', data: order });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/orders/:id/cancel
 */
router.post('/:id/cancel', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = await db.oneOrNone('SELECT status, created_at FROM orders WHERE id = $1 AND user_id = $2', [id, req.userId]);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (!['pending', 'pending_payment', 'processing'].includes(order.status)) {
            return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
        }

        await db.none(`UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);
        res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
