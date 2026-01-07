import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const safeLoad = (file, mount) => {
  const full = path.join(__dirname, file);
  if (fs.existsSync(full)) {
    router.use(mount, (await import(full)).default);
    console.log(`[BossMind] route loaded: ${file}`);
  } else {
    console.log(`[BossMind] route skipped (missing): ${file}`);
  }
};

await safeLoad("./health.cjs", "/health");
await safeLoad("./stripe.cjs", "/webhooks/stripe");
await safeLoad("./tax.cjs", "/tax");
await safeLoad("./avalara.cjs", "/avalara");

export default router;
