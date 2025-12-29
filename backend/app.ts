// app.ts

import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

// Now it is safe to import routes
import authRoutes from './src/routes/auth.routes.js';
import productsRoutes from './src/routes/products.routes.js';
import ordersRoutes from './src/routes/orders.routes.js';
import cartRoutes from './src/routes/cart.routes.js';
import quotesRoutes from './src/routes/quotes.routes.js';
import errorHandler from './src/middleware/errorHandler.js';
import userRoutes from './src/routes/user.routes.js';


// Create Express app
const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

app.use(helmet());

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8080',
    process.env.FRONTEND_URL,  // <--- Crucial for Vercel
    process.env.CLIENT_URL,
].filter(Boolean);             // Removes undefined values


app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin) || origin.startsWith('http://192.168.') || origin.startsWith('http://10.') || origin.startsWith('http://localhost')) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// 1. BODY PARSING MIDDLEWARE (MUST BE HERE)
// ============================================
// This MUST come before any routes are defined!
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// 2. DEBUG LOGGING (Check your terminal!)
// ============================================
// This helps us see exactly what the frontend is sending
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`📝 ${req.method} ${req.path} ${req.ip}`);

        // Log the body for POST/PUT requests to verify data is arriving
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            console.log('📦 Request Body:', req.body ? Object.keys(req.body) : 'undefined');
        }
        next();
    });
}

// ============================================
// STATIC FILES
// ============================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/uploads', express.static(path.join(__dirname, 'src/uploads')));

// ============================================
// API ROUTES
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        clientIP: req.ip
    });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Products routes
app.use('/api/products', productsRoutes);

// Orders routes
app.use('/api/orders', ordersRoutes);

// Cart routes
app.use('/api/cart', cartRoutes);

app.use('/api/quotes', quotesRoutes);

app.use('/api/user', userRoutes);

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path,
        method: req.method
    });
});



// ============================================
// ERROR HANDLER (MUST BE LAST)
// ============================================

app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║           ProtoDesign API Server             ║
╠══════════════════════════════════════════════╣
║ ✅ Server running on port: ${PORT}
║ ✅ Local:          http://localhost:${PORT}
║ ✅ Network:        http://${HOST}:${PORT}
║ 🔧 Environment:    ${process.env.NODE_ENV || 'development'}
╚══════════════════════════════════════════════╝
    `);
});


// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

export default app;