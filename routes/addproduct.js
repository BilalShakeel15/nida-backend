// backend/routes/addproduct.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const product = require('../models/Product');
const { cloudinary, uploadProducts } = require('../config/cloudinary');

const fetchUser = require('../middleware/fetchUser');
const isAdmin = require('../middleware/isAdmin');

const router = express.Router();

router.post('/addproduct', fetchUser, isAdmin, uploadProducts, [
    body('title').isLength({ min: 3 }),
    body('description').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);

        // Validation fail → Cloudinary se delete karo jo abhi upload hua
        if (!errors.isEmpty()) {
            if (req.files) {
                for (const file of req.files) {
                    await cloudinary.uploader.destroy(file.filename);
                }
            }
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, price, quantity, pieces, category, check, highlights, salePrice, tag } = req.body;

        // ⭐ file.path = Cloudinary ka full URL
        const images = req.files ? req.files.map(file => file.path) : [];

        let parsedHighlights = [];
        if (req.body.highlights) {
            try { parsedHighlights = JSON.parse(req.body.highlights); }
            catch (err) { parsedHighlights = []; }
        }

        const newproduct = new product({
            title, description, price, quantity, pieces, check, category, images,
            highlights: parsedHighlights,
            salePrice: salePrice ? Number(salePrice) : null,
            tag: tag || 'New'
        });

        const savedproduct = await newproduct.save();
        res.json({ savedproduct, success: true });

    } catch (error) {
        console.error(error.message);
        // Error pe Cloudinary images delete
        if (req.files) {
            for (const file of req.files) {
                await cloudinary.uploader.destroy(file.filename);
            }
        }
        res.status(500).send('Internal Server Error');
    }
});

router.get('/getproduct/:id', async (req, res) => {
    try {
        const get_product = await product.findById(req.params.id);
        res.json({ get_product, success: true });
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

router.get('/getallproducts', async (req, res) => {
    try {
        const get_products = await product.find();
        res.json({ get_products, success: true });
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

router.put('/updateproduct/:id', fetchUser, isAdmin, async (req, res) => {
    try {
        const { title, description, price, quantity, pieces, category, highlights, salePrice, tag } = req.body;

        const get_product = await product.findById(req.params.id);
        if (!get_product) return res.status(404).json({ success: false, message: 'Product not found' });

        let parsedHighlights = [];
        if (highlights) {
            if (Array.isArray(highlights)) parsedHighlights = highlights;
            else parsedHighlights = highlights.split(',').map(h => h.trim());
        }

        get_product.title = title;
        get_product.description = description;
        get_product.quantity = quantity;
        get_product.pieces = pieces;
        get_product.price = price;
        get_product.category = category;
        get_product.highlights = parsedHighlights;
        get_product.salePrice = salePrice ? Number(salePrice) : null;
        get_product.tag = tag !== undefined ? tag : (get_product.tag || 'New');

        await get_product.save();
        res.json({ get_product, success: true });
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

router.delete('/deleteproduct/:id', fetchUser, isAdmin, async (req, res) => {
    try {
        const productToDelete = await product.findById(req.params.id);
        if (!productToDelete) return res.status(404).json({ success: false, msg: 'Product not found' });

        // ⭐ Cloudinary se delete — URL se public_id nikalte hain
        for (const imageUrl of productToDelete.images) {
            try {
                // URL example: https://res.cloudinary.com/cloud/image/upload/v123/nida-crafteria/products/abc.jpg
                // Public ID: nida-crafteria/products/abc
                const parts = imageUrl.split('/');
                const filenameWithExt = parts[parts.length - 1];
                const filename = filenameWithExt.split('.')[0];
                const folder = parts[parts.length - 3] + '/' + parts[parts.length - 2];
                const publicId = `${folder}/${filename}`;
                await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                console.error('Cloudinary delete error:', err.message);
            }
        }

        await product.findByIdAndDelete(req.params.id);
        res.json({ success: true, msg: 'Deleted' });
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;