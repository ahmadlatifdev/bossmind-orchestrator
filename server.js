require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createClient } = require('@supabase/supabase-js');

// ---------- Global error handlers ----------
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- CORS configuration – allow your frontend domains ----------
const allowedOrigins = [
    'https://resumora-28ulbqesg-resumora.vercel.app',
    'https://www.resumora.net',
    // Add any other domains (e.g., localhost for development)
    'http://localhost:5173',
    'http://localhost:3000'
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus: 200,
    credentials: true
};

app.use(cors(corsOptions));

// ---------- Security & middleware ----------
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"]
        }
    }
}));
app.use(compression());
app.use(express.json());
app.use(express.static('public'));
app.use('/assets', express.static('assets'));

// ---------- Supabase client ----------
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);
console.log('✅ Supabase client initialized');

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'bossmind-uploads';

// ---------- Existing routes ----------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/orders', (req, res) => {
    const order = req.body;
    console.log('📦 New Order:', {
        id: order.id,
        service: order.service,
        amount: order.price,
        customer: order.customer.email.substring(0, 3) + '***',
        timestamp: new Date().toISOString()
    });
    res.json({
        success: true,
        orderId: order.id,
        message: 'Order received and processing',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'operational',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        services: {
            website: 'active',
            database: 'connected',
            email: 'ready',
            payments: 'enabled'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'ResumeAI ResumeAI',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/.well-known/verify-google.html', (req, res) => {
    res.send('<html><head><meta name="google-site-verification" content="BOSS_MIND_GOOGLE_VERIFICATION_CODE" /></head><body>Google site verification for ResumeAI ResumeAI</body></html>');
});

// ---------- File upload endpoints (Supabase) ----------
app.post('/api/generate-upload-url', async (req, res) => {
    try {
        const { fileName, fileType, userId } = req.body;
        if (!fileName || !fileType || !userId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const filePath = `users/${userId}/${Date.now()}-${fileName}`;
        const { data, error } = await supabase
            .storage
            .from(BUCKET_NAME)
            .createSignedUploadUrl(filePath);

        if (error) throw error;

        res.json({
            uploadUrl: data.signedUrl,
            objectKey: filePath
        });
    } catch (err) {
        console.error('❌ Error generating upload URL:', err);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
});

app.post('/api/save-metadata', async (req, res) => {
    try {
        const { objectKey, fileSize, contentType, userId } = req.body;
        if (!objectKey || !fileSize || !contentType || !userId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${objectKey}`;

        const { data, error } = await supabase
            .from('s3_files')
            .insert([{
                object_key: objectKey,
                file_url: publicUrl,
                uploaded_by: userId,
                content_type: contentType,
                file_size: fileSize
            }])
            .select();

        if (error) throw error;

        res.json({ success: true, record: data[0] });
    } catch (err) {
        console.error('❌ Error saving metadata:', err);
        res.status(500).json({ error: 'Failed to save metadata' });
    }
});

// ---------- 404 handler ----------
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'production' ? null : err.message
    });
});

// ---------- Start server with explicit localhost binding ----------
const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════╗
    ║               BossMind + Supabase                        ║
    ╠══════════════════════════════════════════════════════════╣
    ║  Status:  ✅ ONLINE                                      ║
    ║  Port:    ${PORT}                                       ║
    ║  URL:     http://localhost:${PORT}                     ║
    ╚══════════════════════════════════════════════════════════╝
    `);
});

server.on('listening', () => {
    const addr = server.address();
    console.log(`✅ Server is LISTENING on ${addr.address}:${addr.port}`);
});

server.on('error', (err) => {
    console.error('❌ Server error:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Change PORT in .env`);
    } else if (err.code === 'EACCES') {
        console.error('Permission denied. Try a port above 1024 or run as admin.');
    } else {
        console.error('Unexpected error:', err);
    }
    process.exit(1);
});

// ---------- Keep‑alive timer (optional, remove after confirming) ----------
setInterval(() => {
    console.log('⏱️ Server is alive (timer tick)');
}, 5000);