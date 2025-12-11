import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Health Check Route
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", service: "bossmind-orchestrator" });
});

// DeepSeek Example Route (optional)
app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Question is required." });
    }

    res.json({
      answer: "DeepSeek connection active",
      questionReceived: question,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal error", details: err.message });
  }
});

// IMPORTANT: Railway requires this PORT
const PORT = process.env.PORT || 8888;

app.listen(PORT, () => {
  console.log(`BossMind Orchestrator running on PORT ${PORT}`);
});
