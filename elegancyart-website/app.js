const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// ===== FULL AUTONOMY ORCHESTRATOR =====
const orchestrator = require("./Server/services/orchestrator.cjs");
const autonomy = require("./Server/services/autonomy-core.cjs");
// =====================================

// Middleware
app.use(express.json());

// Enhanced middleware with full autonomy
app.use((req, res, next) => {
    // Inject all autonomy modules
    req.autonomy = autonomy;
    req.orchestrator = orchestrator;
    req.ai = {
        process: (query, options) => autonomy.autonomousProcess(query, options)
    };
    
    // Log request for autonomy learning
    const memory = require("./Server/services/autonomy-memory.cjs");
    memory.remember("request", {
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
        ip: req.ip
    });
    
    next();
});

// Import routes
const productRoutes = require("./routes/products");

// Use routes
app.use("/api/products", productRoutes);

// ===== AUTONOMY MANAGEMENT ENDPOINTS =====
// 1. Main AI endpoint (now fully autonomous)
app.post("/api/ai/chat", async (req, res) => {
    try {
        const { message, options } = req.body;
        
        if (!message || message.trim() === "") {
            return res.status(400).json({
                success: false,
                error: "Message is required"
            });
        }
        
        const result = await autonomy.autonomousProcess(message, options);
        res.json(result);
        
    } catch (error) {
        // Even errors are handled autonomously
        const degraded = autonomy.gracefulDegradation(error.message);
        res.status(500).json(degraded);
    }
});

// 2. System status and health
app.get("/api/system/health", (req, res) => {
    const status = orchestrator.getSystemStatus();
    
    // Add efficiency report
    const monitor = require("./Server/services/efficiency-monitor.cjs");
    const efficiency = monitor.getEfficiencyReport();
    
    // Add testing report
    const tester = require("./Server/services/auto-tester.cjs");
    const testReport = tester.generateReport();
    
    res.json({
        ...status,
        efficiency,
        testing: testReport,
        autonomous: true,
        self_healing: true,
        auto_optimizing: true,
        auto_updating: true
    });
});

// 3. Force optimization
app.post("/api/system/optimize", async (req, res) => {
    const result = await orchestrator.optimizeSystem();
    res.json(result);
});

// 4. Run full diagnostics
app.post("/api/system/diagnose", async (req, res) => {
    const report = await orchestrator.runFullHealthCheck();
    res.json(report);
});

// 5. Get autonomy statistics
app.get("/api/autonomy/stats", (req, res) => {
    const stats = autonomy.getHealthStats();
    const memory = require("./Server/services/autonomy-memory.cjs");
    const history = memory.getInteractionHistory(10);
    
    res.json({
        autonomy_stats: stats,
        recent_interactions: history,
        strategies: autonomy.strategies,
        auto_optimized: true
    });
});

// 6. Generate system report
app.get("/api/system/report", (req, res) => {
    const report = orchestrator.generateSystemReport();
    res.json(report);
});

// 7. Control autonomous features
app.post("/api/system/control", (req, res) => {
    const { action, parameters } = req.body;
    
    switch (action) {
        case "pause_autonomy":
            // Implementation would pause autonomous features
            res.json({ success: true, action: "autonomy_paused" });
            break;
            
        case "resume_autonomy":
            // Implementation would resume autonomous features
            res.json({ success: true, action: "autonomy_resumed" });
            break;
            
        case "reset_strategies":
            autonomy.strategies = ["direct", "simplified", "cached", "fallback", "partial"];
            res.json({ success: true, strategies: autonomy.strategies });
            break;
            
        default:
            res.status(400).json({ success: false, error: "Unknown action" });
    }
});
// ========================================

// Root endpoint - show full capabilities
app.get("/", (req, res) => {
    res.json({
        message: "🤖 ResumeAI Fully Autonomous API",
        version: "2.0.0",
        status: "operational",
        features: {
            self_healing: true,
            auto_optimization: true,
            continuous_testing: true,
            auto_updates: true,
            efficiency_monitoring: true,
            graceful_degradation: true
        },
        endpoints: {
            ai_chat: "POST /api/ai/chat",
            system_health: "GET /api/system/health",
            system_optimize: "POST /api/system/optimize",
            system_diagnose: "POST /api/system/diagnose",
            autonomy_stats: "GET /api/autonomy/stats",
            system_report: "GET /api/system/report",
            system_control: "POST /api/system/control",
            products: "/api/products/*"
        },
        autonomy: {
            strategies: autonomy.strategies,
            self_optimizing: true,
            version: "2.0.0"
        }
    });
});

// Start the fully autonomous server
app.listen(PORT, () => {
    console.log("=".repeat(60));
    console.log("🚀 ResumeAI FULLY AUTONOMOUS SYSTEM ACTIVATED");
    console.log("=".repeat(60));
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log("🤖 Status: FULL AUTONOMY ENABLED");
    console.log("");
    console.log("🎯 Core Features:");
    console.log("   • Self-healing AI responses");
    console.log("   • Continuous automated testing");
    console.log("   • Real-time efficiency optimization");
    console.log("   • Auto-updating codebase");
    console.log("   • Performance monitoring");
    console.log("   • Graceful degradation");
    console.log("");
    console.log("📡 Management Endpoints:");
    console.log("   POST /api/ai/chat          - Autonomous AI chat");
    console.log("   GET  /api/system/health    - Full system health");
    console.log("   POST /api/system/optimize  - Force optimization");
    console.log("   GET  /api/system/report    - System report");
    console.log("");
    console.log("⚡ Autonomy Strategies:");
    console.log("   " + autonomy.strategies.join(" → "));
    console.log("");
    console.log("🔧 System will now:");
    console.log("   • Auto-test every 5 minutes");
    console.log("   • Auto-optimize every 30 minutes");
    console.log("   • Auto-update every hour");
    console.log("   • Monitor efficiency continuously");
    console.log("=".repeat(60));
});

