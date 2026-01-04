const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Import routes
const productRoutes = require('./routes/products');

// Use routes
app.use('/api/products', productRoutes);

// Basic route
app.get('/', (req, res) => {
    res.json({ 
        message: 'EleganceArt API is running',
        endpoints: {
            products: '/api/products',
            singleProduct: '/api/products/:id'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running: http://localhost:${PORT}`);
});