// backend/routes/auth.js 101
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

router.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('name').isLength({ min: 3 }).trim().escape(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  let success = false;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success, errors: errors.array() });

  try {
    let user = await User.findOne({ email: req.body.email });
    if (user) return res.status(400).json({ success, error: "User already exists" });

    const salt = bcrypt.genSaltSync(10);
    const secPass = bcrypt.hashSync(req.body.password, salt);
    user = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: secPass,
      address: req.body.address || '',
      role: 'customer' // ✅ never allow role from client
    });

    const data = { id: user.id, role: user.role };
    const authToken = jwt.sign(data, process.env.JWT_SECRET, { expiresIn: '7d' });
    success = true;
    res.json({ success, authToken });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  let success = false;
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success, errors: errors.array() });

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success, error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success, error: "Invalid credentials" });

    const data = { id: user.id, role: user.role };
    // ✅ Added expiry
    const authToken = jwt.sign(data, process.env.JWT_SECRET, { expiresIn: '7d' });
    success = true;
    // ✅ Don't send full user object (has password hash)
    res.json({
      success,
      authToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        address: user.address
      }
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
});

router.get('/getuser', async (req, res) => {
  try {
    const token = req.header('auth-token');
    if (!token) return res.status(401).json({ success: false, message: 'Access denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;