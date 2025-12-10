// ==========================
//  SERVER.JS (FULL FILE)
// ==========================

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

// ====== DeepSeek Controller (Example Placeholder) ======
// You can modify function logic later but route will work now
async function runMission(req, res) {
    try {
        const { mission } = req.body;

        if (!mission) {
            return res.status(400).json({ success: false, message: "No mission provided" });
        }

        // 🔥 Response — Replace inside with real DeepSeek logic later
        return res.json({
            success: true,
            status: "Mission processed",
            received: mission
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

// ==========================
//  EXPRESS APP
// ==========================
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ==========================
//  ROUTES
// ==========================
app.get("/", (req, res) => res.send("Backend Online ✓"));

app.post("/api/missions/run", runMission);    // <<<<<< CONNECTED SUCCESSFULLY

// ==========================
//  START SERVER
// ==========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
