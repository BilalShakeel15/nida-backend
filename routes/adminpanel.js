// backend/routes/adminpanel.js
const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin_db');
const Order = require('../models/Orders');
const Product = require('../models/Product');

const { cloudinary, uploadBanner, uploadCategory, uploadScreenshot } = require('../config/cloudinary');
const fetchUser = require('../middleware/fetchUser');
const isAdmin = require('../middleware/isAdmin');
const sendMail = require('../services/emailService');

// Helper: Cloudinary URL se public_id nikalo
const getPublicId = (url) => {
    try {
        const parts = url.split('/');
        const filenameWithExt = parts[parts.length - 1];
        const filename = filenameWithExt.split('.')[0];
        const folder = parts[parts.length - 3] + '/' + parts[parts.length - 2];
        return `${folder}/${filename}`;
    } catch {
        return null;
    }
};

// ─── SCREENSHOT ───────────────────────────────────────────
router.post('/uploadScreenshot', uploadScreenshot, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });
        // ⭐ file.path = full Cloudinary URL
        res.json({ success: true, imageUrl: req.file.path });
    } catch (error) {
        console.error('Error uploading screenshot:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ─── BANNER ───────────────────────────────────────────────
router.post('/banner', fetchUser, isAdmin, uploadBanner, async (req, res) => {
    try {
        let admin = await Admin.findOne({ name: 'banner' });
        if (!admin) admin = await Admin.create({ name: 'banner' });

        // Purani images Cloudinary se delete karo
        for (const imageUrl of admin.banner_images) {
            const publicId = getPublicId(imageUrl);
            if (publicId) await cloudinary.uploader.destroy(publicId);
        }

        // ⭐ Naye URLs save karo
        admin.banner_images = req.files ? req.files.map(file => file.path) : [];
        await admin.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding banner:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.delete('/banner', fetchUser, isAdmin, async (req, res) => {
    try {
        const admin = await Admin.findOne({ name: 'banner' });
        if (!admin || admin.banner_images.length === 0)
            return res.status(404).json({ success: false, message: 'No banner images found' });

        for (const imageUrl of admin.banner_images) {
            const publicId = getPublicId(imageUrl);
            if (publicId) await cloudinary.uploader.destroy(publicId);
        }

        admin.banner_images = [];
        await admin.save();
        res.json({ success: true, message: 'Banner images deleted' });
    } catch (error) {
        console.error('Error deleting banner:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get('/getbanner', async (req, res) => {
    try {
        const admin = await Admin.findOne({ name: 'banner' });
        if (!admin) return res.status(404).json('Banner not found');
        res.json({ temp_banner: admin.banner_images, success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ─── CATEGORY ─────────────────────────────────────────────
router.get('/getcategory', async (req, res) => {
    try {
        const admin = await Admin.findOne({ name: 'banner' });
        if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

        // ⭐ Image already full URL hai — seedha return karo
        const categories = admin.categories.map(cat => ({
            name: cat.name,
            image: cat.image || null
        }));

        res.json(categories);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.post('/category', uploadCategory, fetchUser, isAdmin, async (req, res) => {
    try {
        const { n, c } = req.body;
        // ⭐ file.path = full Cloudinary URL
        let image = req.file ? req.file.path : null;

        const admin = await Admin.findOne({ name: "banner" });
        if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

        admin.categories.push({ name: c, image });
        await admin.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.delete('/deletecategory/:index', fetchUser, isAdmin, async (req, res) => {
    const index = parseInt(req.params.index, 10);
    try {
        const admin = await Admin.findOne({ name: 'banner' });
        if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

        if (index < 0 || index >= admin.categories.length)
            return res.status(400).json({ success: false, message: 'Invalid index' });

        const deletedCategory = admin.categories[index];

        // ⭐ Cloudinary se delete
        if (deletedCategory.image) {
            const publicId = getPublicId(deletedCategory.image);
            if (publicId) await cloudinary.uploader.destroy(publicId);
        }

        admin.categories.splice(index, 1);
        await admin.save();
        res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ─── ORDERS (same as before — koi change nahi) ────────────
router.post('/addOrder', async (req, res) => {
    try {
        const { Ids, q, name, email, contact, cc, address, paymentScreenshot } = req.body;

        if (!Array.isArray(Ids) || Ids.length === 0)
            return res.status(400).json({ success: false, message: "Invalid products array" });

        const products = Ids.map((id, index) => ({ productId: id, quantity: q[index] || 1 }));

        const newOrder = new Order({ products, name, email, contact, cc, address, paymentScreenshot: paymentScreenshot || null });
        const savedorder = await newOrder.save();

        for (const item of products) {
            const product = await Product.findById(item.productId);
            if (!product) continue;
            if (product.quantity < item.quantity)
                return res.status(400).json({ success: false, message: `Not enough stock for ${product.title}` });
            product.quantity -= item.quantity;
            await product.save();
        }

        const adminEmail = "nidacrafteria@gmail.com";
        const subject = `🛒 New Order from ${name}`;
        const orderSummary = products.map((item, idx) => `#${idx + 1}: Product ID: ${item.productId}, Qty: ${item.quantity}`).join('\n');
        const message = `New Order Received ✅\n\nCustomer: ${name}\nEmail: ${email}\nContact: ${contact}\nCity: ${cc}\nAddress: ${address}\n\nProducts:\n${orderSummary}`;

        sendMail(email, subject, message, adminEmail)
            .then(() => console.log("📧 Order email sent"))
            .catch(err => console.error("❌ Email error:", err));

        res.json({ savedorder, success: true });
    } catch (error) {
        console.error("❌ Order error:", error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

router.get('/getorderlist', fetchUser, isAdmin, async (req, res) => {
    try {
        const get_orderdetails = await Order.find();
        res.json({ get_orderdetails, success: true });
    } catch (error) { res.status(500).send('Internal Server Error'); }
});

router.get('/orderdetail/:id', fetchUser, isAdmin, async (req, res) => {
    try {
        const get_order = await Order.findById(req.params.id);
        res.json({ get_order, success: true });
    } catch (error) { res.status(500).send('Internal Server Error'); }
});

router.delete('/deleteorder/:idd', fetchUser, isAdmin, async (req, res) => {
    await Order.findByIdAndDelete(req.params.idd);
    res.json({ success: true });
});

router.patch('/updateOrderStatus', fetchUser, isAdmin, async (req, res) => {
    try {
        const { orderId, status } = req.body;
        if (!orderId || !status) return res.status(400).json({ success: false, message: "Required fields missing" });

        const allowedStatuses = ['pending', 'confirmed', 'shipped', 'completed'];
        if (!allowedStatuses.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        order.status = status;
        await order.save();

        const subject = `📦 Your Order is now "${status}"`;
        const message = `Dear ${order.name},\n\nYour order status: ${status.toUpperCase()}\n\nThank you!\nNida Crafteria Team`;

        sendMail('nidacrafteria@gmail.com', subject, message, order.email)
            .then(() => console.log("📧 Status email sent"))
            .catch(err => console.error("❌ Email error:", err));

        res.json({ success: true, updatedOrder: order });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

router.get('/getconfirmorders', fetchUser, isAdmin, async (req, res) => {
    try {
        const get_orderdetails = await Order.find({ status: "completed" });
        res.json({ get_orderdetails, success: true });
    } catch (error) { res.status(500).send('Internal Server Error'); }
});

module.exports = router;