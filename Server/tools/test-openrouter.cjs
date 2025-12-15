// D:\Shakhsy11\Bossmind-orchestrator\Server\tools\test-openrouter.cjs
require("dotenv").config();

const https = require("https");

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("❌ Missing OPENROUTER_API_KEY");
  process.exit(1);
}

const data = JSON.stringify({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Say OK" }],
});

const options = {
  hostname: "openrouter.ai",
  path: "/api/v1/chat/completions",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "Content-Length": Buffer.byteLength(data),
  },
};

const req = https.request(options, (res) => {
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => {
    console.log("HTTP", res.statusCode);
    console.log(body);
  });
});

req.on("error", (err) => {
  console.error("REQUEST FAILED:", err.message);
});

req.write(data);
req.end();
