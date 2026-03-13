// backend/db.js
const mongoose = require('mongoose')
require('dotenv').config()
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/nida_crafteria';
        await mongoose.connect(mongoURI)
        console.log("Mongodb Connected Successfully!");

    } catch (error) {
        console.log(error);
        process.exit(1)

    }
}

module.exports = connectDB