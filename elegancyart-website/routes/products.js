const express = require('express');
const router = express.Router();

// Sample products data
const products = [
    {
        id: 1,
        name: 'Abstract Canvas Painting',
        description: 'Modern abstract art canvas for living room decoration',
        price: 89.99,
        category: 'Wall Art',
        image_url: '',
        supplier_url: '',
        profit_margin: 40.00,
        tags: ['wall-art', 'modern'],
        is_active: true
    },
    {
        id: 2,
        name: 'Personalized Family Name Sign',
        description: 'Modern wooden sign with custom family name',
        price: 49.99,
        category: 'Personalized Gifts',
        image_url: '',
        supplier_url: '',
        profit_margin: 60.00,
        tags: ['personalized', 'wood', 'home'],
        is_active: true
    }
];

// GET all products
router.get('/', (req, res) => {
    res.json({
        success: true,
        count: products.length,
        products: products
    });
});

// GET single product by ID
router.get('/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        return res.status(404).json({
            success: false,
            error: 'Product not found'
        });
    }
    
    res.json({
        success: true,
        product: product
    });
});

module.exports = router;