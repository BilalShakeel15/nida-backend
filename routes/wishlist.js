// backend/routes/wishlist.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const fetchUser = require('../middleware/fetchUser');

// Add product to wishlist
router.post('/add', fetchUser, async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.user.id;

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Check if already in wishlist
        const user = await User.findById(userId);
        if (user.wishlist.includes(productId)) {
            return res.status(400).json({ success: false, message: 'Product already in wishlist' });
        }

        // Add to wishlist
        user.wishlist.push(productId);
        await user.save();

        res.json({ success: true, message: 'Product added to wishlist' });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Remove product from wishlist
router.delete('/remove/:productId', fetchUser, async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.user.id;

        const user = await User.findById(userId);
        user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
        await user.save();

        res.json({ success: true, message: 'Product removed from wishlist' });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get user's wishlist
router.get('/get', fetchUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).populate('wishlist');

        res.json({ success: true, wishlist: user.wishlist });
    } catch (error) {
        console.error('Error getting wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Check if product is in wishlist
router.get('/check/:productId', fetchUser, async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.user.id;

        const user = await User.findById(userId);
        const isInWishlist = user.wishlist.includes(productId);

        res.json({ success: true, isInWishlist });
    } catch (error) {
        console.error('Error checking wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;

