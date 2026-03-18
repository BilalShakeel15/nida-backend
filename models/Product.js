const mongoose = require('mongoose');

const Product = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true, unique: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true },
    pieces: { type: Number, required: true },
    check: { type: Boolean, default: false },
    category: { type: String, required: true },
    date: { type: Date, default: Date.now },
    images: { type: [String] },
    highlights: { type: [String], default: [] },

    // ── NEW FIELDS ──
    salePrice: { type: Number, default: null },      // null = no sale
    tag: {
        type: String,
        enum: ['New', 'Popular', 'Limited', 'Sale', ''],
        default: 'New'
    }
});

module.exports = mongoose.model('product', Product);