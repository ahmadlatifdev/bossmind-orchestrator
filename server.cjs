const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3005;
const DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("❌ Missing NEON_DATABASE_URL or DATABASE_URL in .env");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS bossmind_memory (
            id BIGSERIAL PRIMARY KEY,
            memory_key TEXT NOT NULL UNIQUE,
            memory_value JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_bossmind_memory_key
        ON bossmind_memory(memory_key);
    `);

    console.log("✅ Connected to Neon database");
}

app.get("/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({
            success: true,
            status: "BossMind Server ONLINE",
            database: "connected"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: "BossMind Server ONLINE",
            database: "disconnected",
            error: error.message
        });
    }
});

app.post("/memory/save", async (req, res) => {
    try {
        const { key, value } = req.body;

        if (!key) {
            return res.status(400).json({
                success: false,
                message: "Missing memory key"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO bossmind_memory (memory_key, memory_value, updated_at)
            VALUES ($1, $2::jsonb, NOW())
            ON CONFLICT (memory_key)
            DO UPDATE SET
                memory_value = EXCLUDED.memory_value,
                updated_at = NOW()
            RETURNING memory_key, memory_value, updated_at
            `,
            [key, JSON.stringify(value)]
        );

        res.json({
            success: true,
            saved: result.rows[0].memory_key,
            value: result.rows[0].memory_value,
            updated_at: result.rows[0].updated_at
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to save memory",
            error: error.message
        });
    }
});

app.get("/memory/get/:key", async (req, res) => {
    try {
        const key = req.params.key;

        const result = await pool.query(
            `
            SELECT memory_key, memory_value, updated_at
            FROM bossmind_memory
            WHERE memory_key = $1
            LIMIT 1
            `,
            [key]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Memory not found"
            });
        }

        res.json({
            success: true,
            key: result.rows[0].memory_key,
            value: result.rows[0].memory_value,
            updated_at: result.rows[0].updated_at
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to get memory",
            error: error.message
        });
    }
});

app.get("/memory/list", async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT memory_key, memory_value, updated_at
            FROM bossmind_memory
            ORDER BY updated_at DESC, memory_key ASC
            `
        );

        const memory = {};
        for (const row of result.rows) {
            memory[row.memory_key] = row.memory_value;
        }

        res.json({
            success: true,
            count: result.rows.length,
            memory: memory
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to list memory",
            error: error.message
        });
    }
});

initDatabase()
    .then(() => {
        app.listen(PORT, "0.0.0.0", () => {
            console.log("==================================");
            console.log("✅ BossMind Server ONLINE");
            console.log("🌐 Host: 0.0.0.0");
            console.log("📡 Port:", PORT);
            console.log("🔗 Server is LISTENING on 0.0.0.0:" + PORT);
            console.log("🧠 Service: BossMind ResumeAI");
            console.log("📦 Version: 1.0");
            console.log("🗄️ Neon Configured: YES");
            console.log("==================================");
        });

        setInterval(() => {
            console.log("⏱️ Server is alive (timer tick)");
        }, 10000);
    })
    .catch((error) => {
        console.error("❌ Failed to start BossMind server:", error.message);
        process.exit(1);
    });