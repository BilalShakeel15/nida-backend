// backend/routes/message.js
const express = require('express');
const sendMail = require('../services/emailService');
const router = express.Router();

router.post('/message', async (req, res) => {
  const { email, name, msg } = req.body;

  if (!email || !name || !msg)
    return res.status(400).json({ success: false, message: "All fields required" });

  try {
    await sendMail(email, `Message from ${name}`, msg, process.env.EMAIL_USER);
    res.status(200).json({ success: true, message: "Message sent" });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
