// backend / routes / addproduct.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const product = require('../models/Product');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const fetchUser = require('../middleware/fetchUser');
const isAdmin = require('../middleware/isAdmin');

const router = express.Router();

let storage = multer.diskStorage({
    destination: path.join(__dirname, '../uploads'),
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '_' + Date.now() + path.extname(file.originalname));
    }
});

let upload = multer({ storage }).array('images', 5);


router.post('/addproduct', fetchUser, isAdmin, upload, [
    body('title').isLength({ min: 3 }),
    body('description').isLength({ min: 6 })
], async (req, res) => {
    try {
        // const { title, description, price, quantity, pieces, category, check } = req.body;
        const { title, description, price, quantity, pieces, category, check, highlights } = req.body;
        console.log(highlights);

        const images = req.files ? req.files.map(file => file.filename) : [];

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // delete uploaded files before sending error
            images.forEach(file => {
                const filePath = path.join(__dirname, '../uploads', file);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            });
            return res.status(400).json({ errors: errors.array() });
        }

        let parsedHighlights = [];

        if (req.body.highlights) {
            try {
                parsedHighlights = JSON.parse(req.body.highlights);
            } catch (err) {
                parsedHighlights = [];
            }
        }



        const newproduct = new product({
            title,
            description,
            price,
            quantity,
            pieces,
            check,
            category,
            images,
            highlights: parsedHighlights   // 👈 added
        });
        console.log(newproduct);



        const savedproduct = await newproduct.save();
        res.json({ savedproduct, success: true });

    } catch (error) {
        console.error(error.message);

        // ❗ Delete uploaded images if error occurs
        if (req.files) {
            req.files.forEach(file => {
                const filePath = path.join(__dirname, '../uploads', file.filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            });
        }

        res.status(500).send('Internal Server Error');
    }
});


router.get('/getproduct/:id', async (req, res) => {
    try {
        const get_product = await product.findById(req.params.id);
        res.json({ get_product, success: true });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/getallproducts', async (req, res) => {
    try {
        const get_products = await product.find();
        res.json({ get_products, success: true });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
});

router.put('/updateproduct/:id', fetchUser, isAdmin, async (req, res) => {
    try {
        // const { title, description, price, quantity, pieces, category } = req.body;
        const { title, description, price, quantity, pieces, category, highlights } = req.body;

        const get_product = await product.findById(req.params.id);
        if (!get_product) return res.status(404).json({ success: false, message: 'Product not found' });
        let parsedHighlights = [];

        if (highlights) {
            if (Array.isArray(highlights)) {
                parsedHighlights = highlights;
            } else {
                parsedHighlights = highlights.split(',').map(h => h.trim());
            }
        }

        get_product.title = title;
        get_product.description = description;
        get_product.quantity = quantity;
        get_product.pieces = pieces;
        get_product.price = price;
        get_product.category = category;
        get_product.highlights = parsedHighlights;


        await get_product.save();
        res.json({ get_product, success: true });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
});

router.delete('/deleteproduct/:id', fetchUser, isAdmin, async (req, res) => {
    try {
        const productToDelete = await product.findById(req.params.id);
        if (!productToDelete) return res.status(404).json({ success: false, msg: 'Product not found' });

        productToDelete.images.forEach(imageFilename => {
            const filePath = path.join(__dirname, '../uploads', imageFilename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

        await product.findByIdAndDelete(req.params.id);
        res.json({ success: true, msg: 'Deleted' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;