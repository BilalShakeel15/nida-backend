// backend/models/Admin_db.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const adminSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    categories: [
        {
            name: { type: String, required: true },
            image: { type: String, default: null }
        }
    ],

    banner_images: [{
        type: String
    }],
    date: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
