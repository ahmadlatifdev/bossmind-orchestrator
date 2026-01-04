// Server/videoQueueTest.js
import express from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.ts";

const router = express.Router();

/**
 * GET /api/video-queue/test
 * Returns: latest 5 rows from public.video_queue
 */
router.get("/test", async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("video_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, count: data?.length ?? 0, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * POST /api/video-queue/test
 * Body: { "title": "Test", "status": "queued" }
 * Inserts one row into public.video_queue
 */
router.post("/test", async (req, res) => {
  try {
    const { title, status } = req.body ?? {};

    const payload = {
      title: typeof title === "string" ? title : "Test Job",
      status: typeof status === "string" ? status : "queued",
    };

    const { data, error } = await supabaseAdmin
      .from("video_queue")
      .insert(payload)
      .select()
      .single();

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

export default router;
