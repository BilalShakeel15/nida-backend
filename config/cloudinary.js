// backend/config/cloudinary.js  ← naya folder/file banao
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Product images
const productStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'nida-crafteria/products',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
    }
});

// Banner images
const bannerStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'nida-crafteria/banners',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
    }
});

// Category images
const categoryStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'nida-crafteria/categories',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
    }
});

// Payment screenshots
const screenshotStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'nida-crafteria/screenshots',
        allowed_formats: ['jpg', 'jpeg', 'png'],
    }
});

module.exports = {
    cloudinary,
    uploadProducts: multer({ storage: productStorage }).array('images', 5),
    uploadBanner: multer({ storage: bannerStorage }).array('images', 5),
    uploadCategory: multer({ storage: categoryStorage }).single('image'),
    uploadScreenshot: multer({ storage: screenshotStorage }).single('image'),
};