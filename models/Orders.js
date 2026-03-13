// backend/models/Orders.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
    products: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        quantity: Number
    }],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    name: String,
    email: String,
    contact: String,
    cc: String, // country/city
    address: String,
    paymentScreenshot: String, // URL to payment screenshot
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'shipped', 'completed'],
        default: 'pending'
    },
    date: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
