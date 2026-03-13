// backend/models/User.js

// const { type } = require('@testing-library/user-event/dist/type');
const mongoose = require('mongoose');
const { Schema } = mongoose;


const User = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'orders'
    }],
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product'
    }],
    check: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ['customer', 'admin'],
        default: 'customer'  // Default role is customer
    },
    date: {
        type: Date,
        default: Date.now
    }

})


module.exports = mongoose.model('user', User)
