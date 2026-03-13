// backend/middleware/fetchUser.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const fetchUser = (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) return res.status(401).json({ error: "Access Denied: No token provided" });

    try {
        const data = jwt.verify(token, process.env.JWT_SECRET);
        req.user = data; // Includes both id and role
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid token" });
    }
};

module.exports = fetchUser;