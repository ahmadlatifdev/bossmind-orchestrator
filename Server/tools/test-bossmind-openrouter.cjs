// D:\Shakhsy11\Bossmind-orchestrator\Server\tools\test-bossmind-openrouter.cjs
require("dotenv").config();

const http = require("http");

const PORT = process.env.PORT || 5000; // will try PORT, else 5004
const body = JSON.stringify({
  messages: [{ role: "user", content: "Say OK" }],
});

const opts = {
  hostname: "localhost",
  port: PORT,
  path: "/api/openrouter/chat",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
};

const req = http.request(opts, (res) => {
  let data = "";
  res.on("data", (c) => (data += c));
  res.on("end", () => {
    console.log("HTTP", res.statusCode);
    console.log(data);
  });
});

req.on("error", (e) => {
  console.error("REQUEST FAILED:", e.message);
  console.error("TIP: Your BossMind server may be on a different port (auto-port).");
});

req.write(body);
req.end();
