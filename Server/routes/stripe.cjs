import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ ok: true, route: "/webhooks/stripe", method: "GET" });
});

router.post("/", (req, res) => {
  console.log("[Stripe] webhook received");
  res.json({ received: true });
});

export default router;
