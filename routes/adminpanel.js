// backend/routes/adminpanel.js
const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin_db');
const Order = require('../models/Orders');
const Product = require('../models/Product'); // Make sure it's imported
// const Confirm = require('../models/ConfirmOrders');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const fetchUser = require('../middleware/fetchUser');
const isAdmin = require('../middleware/isAdmin');
const sendMail = require('../services/emailService');

let storage = multer.diskStorage({
    destination: path.join(__dirname, '../uploads'),
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '_' + Date.now() + path.extname(file.originalname));
    }
});
const categoryStorage = multer.diskStorage({
    destination: path.join(__dirname, '../uploads/categories'),
    filename: (req, file, cb) => {
        cb(null, 'category_' + Date.now() + path.extname(file.originalname));
    },
});
const uploadCategoryImage = multer({ storage: categoryStorage }).single('image');
let upload = multer({ storage }).array('images', 5);
let uploadSingle = multer({ storage }).single('image');

// Add route for uploading payment screenshots
router.post('/uploadScreenshot', uploadSingle, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }

        const imageUrl = req.file.filename;
        res.json({ success: true, imageUrl });
    } catch (error) {
        console.error('Error uploading screenshot:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.post('/banner', fetchUser, isAdmin, upload, async (req, res) => {
    try {
        let admin = await Admin.findOne({ name: 'banner' });
        if (!admin) admin = await Admin.create({ name: 'banner' });

        // Delete old images
        admin.banner_images.forEach(image => {
            const filePath = path.join(__dirname, '../uploads', image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

        admin.banner_images = req.files ? req.files.map(file => file.filename) : [];
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

        if (!admin || admin.banner_images.length === 0) {
            return res.status(404).json({ success: false, message: 'No banner images found' });
        }

        // Delete images from file system
        admin.banner_images.forEach(image => {
            const filePath = path.join(__dirname, '../uploads', image);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });

        // Clear banner_images array
        admin.banner_images = [];
        await admin.save();

        res.json({ success: true, message: 'Banner images deleted' });

    } catch (error) {
        console.error('❌ Error deleting banner images:', error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});


router.get('/getbanner', async (req, res) => {
    try {
        const admin = await Admin.findOne({ name: 'banner' });
        if (!admin) return res.status(404).json('Banner not found');
        res.json({ temp_banner: admin.banner_images, success: true });
    } catch (error) {
        console.error('Error getting banner:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.get('/getcategory', async (req, res) => {
    try {
        const admin = await Admin.findOne({ name: 'banner' });
        if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

        // Return categories with image path
        backend_uri = process.env.BACKEND_URL
        const categories = admin.categories.map(cat => ({
            name: cat.name,
            image: cat.image ? `${backend_uri}/uploads/categories/${cat.image}` : null
        }));

        res.json(categories);
    } catch (error) {
        console.error('Error getting category:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// Add Category with image 
router.post('/category', uploadCategoryImage, fetchUser, isAdmin, async (req, res) => {
    try {
        const { n, c } = req.body;
        console.log("recieved", n, c);

        let image = req.file ? req.file.filename : null;

        const admin = await Admin.findOne({ name: "banner" });
        if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

        // Each category = { name, image }
        admin.categories.push({ name: c, image });
        console.log("name", c);

        await admin.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error adding category:', error);
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

        // Delete image file if exists
        if (deletedCategory.image) {
            const filePath = path.join(__dirname, '../uploads/categories', deletedCategory.image);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        admin.categories.splice(index, 1);
        await admin.save();

        res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


router.post('/addOrder', async (req, res) => {
    try {
        const { Ids, q, name, email, contact, cc, address, paymentScreenshot } = req.body;

        if (!Array.isArray(Ids) || Ids.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid products array" });
        }

        // Create products array with proper structure
        const products = Ids.map((id, index) => ({
            productId: id,
            quantity: q[index] || 1
        }));

        const newOrder = new Order({
            products,
            name,
            email,
            contact,
            cc,
            address,
            paymentScreenshot: paymentScreenshot || null
        });

        const savedorder = await newOrder.save();

        // Update product quantities
        for (const item of products) {
            const product = await Product.findById(item.productId);
            if (!product) continue;

            if (product.quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for ${product.title}`
                });
            }

            product.quantity -= item.quantity;
            await product.save();
        }

        // ✅ Send email to admin
        const adminEmail = "nidacrafteria@gmail.com"; // change if needed
        const subject = `🛒 New Order from ${name}`;
        const orderSummary = products
            .map((item, idx) => `#${idx + 1}: Product ID: ${item.productId}, Qty: ${item.quantity}`)
            .join('\n');

        const message = `
New Order Received ✅

Customer: ${name}
Email: ${email}
Contact: ${contact}
Country/City: ${cc}
Address: ${address}
Payment Screenshot: ${paymentScreenshot ? 'Attached' : 'Not provided'}

Ordered Products:
${orderSummary}

Regards,
Nida Crafteria System
        `;

        sendMail(email, subject, message, adminEmail)
            .then(() => console.log("📧 Order email sent to admin"))
            .catch(err => console.error("❌ Email error:", err));

        res.json({ savedorder, success: true });

    } catch (error) {
        console.error("❌ Error creating order:", error.message);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});


router.get('/getorderlist', fetchUser, isAdmin, async (req, res) => {
    try {
        const get_orderdetails = await Order.find();
        res.json({ get_orderdetails, success: true });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/orderdetail/:id', fetchUser, isAdmin, async (req, res) => {
    try {
        const get_order = await Order.findById(req.params.id);
        res.json({ get_order, success: true });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
});

router.delete('/deleteorder/:idd', fetchUser, isAdmin, async (req, res) => {
    await Order.findByIdAndDelete(req.params.idd);
    res.json({ success: true });
});



router.patch('/updateOrderStatus', fetchUser, isAdmin, async (req, res) => {
    try {
        const { orderId, status } = req.body;

        if (!orderId || !status) {
            return res.status(400).json({ success: false, message: "Order ID and status are required" });
        }

        const allowedStatuses = ['pending', 'confirmed', 'shipped', 'completed'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value" });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Update order status
        order.status = status;
        await order.save();

        // ✅ Send email to customer
        const subject = `📦 Your Order is now "${status}"`;
        const message = `
Dear ${order.name},

Your order placed on ${order.createdAt?.toDateString() || order.date.toDateString()} has been updated.

📝 Current Status: ${status.toUpperCase()}

We will keep you posted on further updates.

Thank you for shopping with us!

Best Regards,  
Nida Crafteria Team
        `;

        sendMail(
            'nidacrafteria@gmail.com', // from
            subject,
            message,
            order.email // to customer
        )
            .then(() => console.log("📧 Status update email sent"))
            .catch(err => console.error("❌ Email error:", err));

        res.json({ success: true, updatedOrder: order });

    } catch (error) {
        console.error("❌ Error updating order:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});



router.get('/getconfirmorders', fetchUser, isAdmin, async (req, res) => {
    try {
        const get_orderdetails = await Order.find({ status: "completed" });
        res.json({ get_orderdetails, success: true });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/confirmorderdetails/:id', fetchUser, isAdmin, async (req, res) => {
    try {
        const get_order = await Confirm.findById(req.params.id);
        res.json({ get_order, success: true });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;