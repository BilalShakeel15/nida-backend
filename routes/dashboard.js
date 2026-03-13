// backend/routes/dashboard.js new
const express = require('express');
const router = express.Router();
const Order = require('../models/Orders');
const Product = require('../models/Product');
const User = require('../models/User');
const fetchUser = require('../middleware/fetchUser');
const isAdmin = require('../middleware/isAdmin');

// ✅ GET /api/dashboard/stats - Main dashboard stats
router.get('/stats', fetchUser, isAdmin, async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Total orders
        const totalOrders = await Order.countDocuments();
        const ordersThisMonth = await Order.countDocuments({ createdAt: { $gte: startOfMonth } });
        const ordersLastMonth = await Order.countDocuments({
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        });

        // Orders by status
        const ordersByStatus = await Order.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Total revenue (from completed orders)
        // Replace the revenueData aggregation with this simpler version:
        // Replace revenueData aggregation:
        const revenueData = await Order.aggregate([
            { $match: { status: 'completed' } },
            { $unwind: '$products' },

            {
                $lookup: {
                    from: 'products',
                    localField: 'products.productId',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },

            { $unwind: '$productInfo' }, // ❗ remove preserveNullAndEmptyArrays

            {
                $project: {
                    quantity: { $toDouble: '$products.quantity' },
                    price: { $toDouble: '$productInfo.price' }
                }
            },

            {
                $group: {
                    _id: null,
                    total: { $sum: { $multiply: ['$quantity', '$price'] } }
                }
            }
        ]);

        // Revenue this month
        const revenueThisMonth = await Order.aggregate([
            { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products.productId',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $group: { _id: null, total: { $sum: 1 } } } // simplified
        ]);

        // Total products
        const totalProducts = await Product.countDocuments();
        const outOfStockProducts = await Product.countDocuments({ quantity: 0 });
        const lowStockProducts = await Product.countDocuments({ quantity: { $gt: 0, $lte: 5 } });

        // Total users
        const totalUsers = await User.countDocuments({ role: 'customer' });
        // Replace usersThisMonth query:
        const usersThisMonth = await User.countDocuments({
            role: 'customer',
            date: { $gte: startOfMonth }  // ye theek hai, User model mein date field hai
        });

        // Recent orders (last 10)
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('name email status createdAt products cc');

        // Order trend - last 7 days
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const count = await Order.countDocuments({
                createdAt: { $gte: date, $lt: nextDate }
            });

            last7Days.push({
                date: date.toISOString().split('T')[0],
                orders: count
            });
        }

        // Monthly order trend (last 6 months)
        const monthlyTrend = [];
        for (let i = 5; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
            const count = await Order.countDocuments({ createdAt: { $gte: start, $lte: end } });
            monthlyTrend.push({
                month: start.toLocaleString('default', { month: 'short', year: 'numeric' }),
                orders: count
            });
        }

        res.json({
            success: true,
            stats: {
                orders: {
                    total: totalOrders,
                    thisMonth: ordersThisMonth,
                    lastMonth: ordersLastMonth,
                    byStatus: ordersByStatus,
                    trend7Days: last7Days,
                    monthlyTrend
                },
                revenue: {
                    total: revenueData[0]?.total || 0,
                },
                products: {
                    total: totalProducts,
                    outOfStock: outOfStockProducts,
                    lowStock: lowStockProducts
                },
                users: {
                    total: totalUsers,
                    thisMonth: usersThisMonth
                },
                recentOrders
            }
        });

    } catch (error) {
        console.error('Dashboard stats error:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// ✅ GET /api/dashboard/top-products - Best selling products
router.get('/top-products', fetchUser, isAdmin, async (req, res) => {
    try {
        const topProducts = await Order.aggregate([
            { $unwind: '$products' },
            {
                $group: {
                    _id: '$products.productId',
                    totalSold: { $sum: '$products.quantity' },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $project: {
                    _id: 1,
                    totalSold: 1,
                    orderCount: 1,
                    title: '$product.title',
                    price: '$product.price',
                    category: '$product.category',
                    images: '$product.images',
                    quantity: '$product.quantity'
                }
            }
        ]);

        res.json({ success: true, topProducts });
    } catch (error) {
        console.error('Top products error:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// ✅ GET /api/dashboard/inventory - Inventory overview
router.get('/inventory', fetchUser, isAdmin, async (req, res) => {
    try {
        const products = await Product.find()
            .select('title category quantity price images')
            .sort({ quantity: 1 }); // low stock first

        const categorySummary = await Product.aggregate([
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    totalStock: { $sum: '$quantity' }
                }
            }
        ]);

        res.json({
            success: true,
            inventory: {
                products,
                categorySummary,
                totalProducts: products.length,
                outOfStock: products.filter(p => p.quantity === 0).length,
                lowStock: products.filter(p => p.quantity > 0 && p.quantity <= 5).length
            }
        });
    } catch (error) {
        console.error('Inventory error:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// ✅ GET /api/dashboard/orders-summary - Orders with full details
router.get('/orders-summary', fetchUser, isAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status) filter.status = status;

        const orders = await Order.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Order.countDocuments(filter);

        res.json({
            success: true,
            orders,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Orders summary error:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

module.exports = router;