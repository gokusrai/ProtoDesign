// app.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './src/routes/auth.routes.js';
import productsRoutes from './src/routes/products.routes.js';
import ordersRoutes from './src/routes/orders.routes.js';
import cartRoutes from './src/routes/cart.routes.js';
import errorHandler from './src/middleware/errorHandler.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

app.use(helmet());

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://192.168.29.39:3000',     // ✅ Network frontend
    'http://192.168.29.39:5173',     // ✅ Network Vite dev
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(cors({
    origin: (origin, callback) => {
        // ✅ Allow network access in development
        if (process.env.NODE_ENV === 'development' || !origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================
// BODY PARSING MIDDLEWARE
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// REQUEST LOGGING (Development)
// ============================================

if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`📝 ${req.method} ${req.path} ${req.ip}`);
        next();
    });
}

// ============================================
// API ROUTES
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        networkIP: 'http://192.168.29.39:3001',  // ✅ Your IP
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
// SERVER STARTUP - NETWORK READY
// ============================================

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';  // ✅ Bind to ALL network interfaces

const server = app.listen(PORT, HOST, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║           ProtoDesign API Server             ║
╠══════════════════════════════════════════════╣
║ ✅ Server running on port: ${PORT}
║ ✅ Local:          http://localhost:${PORT}
║ ✅ Network (Phone): http://192.168.29.39:${PORT}
║ 🔧 Environment:    ${process.env.NODE_ENV || 'development'}
║ 📊 Database:       ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}
╚══════════════════════════════════════════════╝

📱 PHONE/TABLET ACCESS (Same WiFi):
   Frontend: http://192.168.29.39:3000
   Backend:  http://192.168.29.39:${PORT}/api

🔗 Test Endpoints:
   Health:    GET  http://192.168.29.39:${PORT}/api/health
   Products:  GET  http://192.168.29.39:${PORT}/api/products
   Cart:      GET  http://192.168.29.39:${PORT}/api/cart (after login)
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
