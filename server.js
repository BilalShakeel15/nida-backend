// backend/server.js 36
const express = require('express');
const connectToMongo = require('./db');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'nida_crafteria_secret_key_2024';
}

const app = express();
const PORT = process.env.PORT || 5000;

connectToMongo();

// ✅ Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ✅ Compression
app.use(compression());
// Render ke proxy ke liye zarori
app.set('trust proxy', 1);

// ✅ CORS - restrict to your frontend domain in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many login attempts, please try again later.' }
});
app.use('/api/auth/', authLimiter);

// Static files
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use('/uploads/categories', express.static(path.join(__dirname, 'uploads/categories')));

// ✅ Keep-alive ping route (for Render free tier)
app.get('/ping', (req, res) => {
    res.status(200).json({ success: true, message: 'pong', timestamp: new Date().toISOString() });
});

// ✅ Self-ping every 30 seconds (keeps Render from sleeping)


// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/msg', require('./routes/message'));
app.use('/api/admin', require('./routes/adminpanel'));
app.use('/api/product', require('./routes/addproduct'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/dashboard', require('./routes/dashboard')); // ✅ New dashboard route

// ✅ Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.message);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});