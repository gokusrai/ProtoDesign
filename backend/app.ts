// backend/app.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './src/routes/auth.routes.js';
import productsRoutes from './src/routes/products.routes.js';
import ordersRoutes from './src/routes/orders.routes.js';
import cartRoutes from './src/routes/cart.routes.js';
import quotesRoutes from './src/routes/quotes.routes.js';
import errorHandler from './src/middleware/errorHandler.js';
import userRoutes from './src/routes/user.routes.js';

const app = express();

// ============================================
// 1. SECURITY MIDDLEWARE (Updated)
// ============================================

// Allow Google Login Popups and Cross-Origin Images
app.use(helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
    process.env.FRONTEND_URL,                    // Matches the variable in App Runner
    'https://master.d1nvmqnm9trfi1.amplifyapp.com' // ✅ Your specific Frontend URL
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Check if origin is allowed
        if (allowedOrigins.includes(origin) || 
            process.env.NODE_ENV === 'development' && (
                origin.startsWith('http://192.168.') || 
                origin.startsWith('http://10.') || 
                origin.startsWith('http://localhost')
            )
        ) {
            return callback(null, true);
        }
        
        console.log('❌ CORS Blocked Origin:', origin); // Log blocked origins for debugging
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ============================================
// 2. BODY PARSING
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// 3. DEBUG LOGGING
// ============================================
app.use((req, res, next) => {
    // Only log in production if it's an error or critical path, 
    // but for now, logging everything helps debug the deployment.
    console.log(`📝 ${req.method} ${req.path} from ${req.ip}`);
    next();
});

// ============================================
// 4. STATIC FILES
// ============================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'src/uploads')));

// ============================================
// 5. API ROUTES
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        allowedOrigins: allowedOrigins // Helpful to see what is allowed in production logs
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/user', userRoutes);

// ============================================
// 6. ERROR HANDLING
// ============================================
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.path });
});

app.use(errorHandler);

// ============================================
// 7. SERVER START
// ============================================
const PORT = Number(process.env.PORT || 3001);
const HOST = '0.0.0.0'; // Must be 0.0.0.0 for AWS/Render

const server = app.listen(PORT, HOST, () => {
    console.log(`✅ Server running on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing server...');
    server.close(() => process.exit(0));
});

export default app;
