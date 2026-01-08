// bossmind-dashboard/Dashboard.jsx
import React, { useMemo, useState } from "react";
import { pickNextTitle, markUsed } from "./bossmindRailwayClient.js";

export default function Dashboard() {
  // ✅ IMPORTANT: put your Railway backend base URL here
  // Example: https://your-service.up.railway.app
  const RAILWAY_BASE_URL = useMemo(() => {
    return (
      (typeof window !== "undefined" && window.__RAILWAY_BASE_URL__) ||
      process.env.REACT_APP_RAILWAY_BASE_URL ||
      process.env.NEXT_PUBLIC_RAILWAY_BASE_URL ||
      ""
    );
  }, []);

  const [loadingPick, setLoadingPick] = useState(false);
  const [loadingMark, setLoadingMark] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null);

  const onPickNext = async () => {
    setError("");
    setPicked(null);

    if (!RAILWAY_BASE_URL) {
      setError(
        "Missing Railway Base URL. Set REACT_APP_RAILWAY_BASE_URL or NEXT_PUBLIC_RAILWAY_BASE_URL."
      );
      return;
    }

    try {
      setLoadingPick(true);
      const data = await pickNextTitle(RAILWAY_BASE_URL);
      setPicked(data);
    } catch (e) {
      setError(e?.message || "Failed to pick next title.");
    } finally {
      setLoadingPick(false);
    }
  };

  const onMarkUsed = async () => {
    setError("");

    if (!RAILWAY_BASE_URL) {
      setError(
        "Missing Railway Base URL. Set REACT_APP_RAILWAY_BASE_URL or NEXT_PUBLIC_RAILWAY_BASE_URL."
      );
      return;
    }

    if (!picked?.row_id) {
      setError("Nothing to mark as used yet. Pick a title first.");
      return;
    }

    try {
      setLoadingMark(true);
      await markUsed(RAILWAY_BASE_URL, {
        row_id: picked.row_id,
        video_id: picked.video_id || null,
      });
      setPicked((p) => (p ? { ...p, status: "USED" } : p));
    } catch (e) {
      setError(e?.message || "Failed to mark used.");
    } finally {
      setLoadingMark(false);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>BossMind Admin Dashboard</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button onClick={onPickNext} disabled={loadingPick}>
          {loadingPick ? "Picking..." : "Pick Next Title"}
        </button>

        <button
          onClick={onMarkUsed}
          disabled={loadingMark || !picked?.row_id}
          title={!picked?.row_id ? "Pick a title first" : ""}
        >
          {loadingMark ? "Marking..." : "Mark Used"}
        </button>
      </div>

      {error ? (
        <div
          style={{
            padding: 10,
            border: "1px solid #f5c2c7",
            background: "#f8d7da",
            color: "#842029",
            borderRadius: 8,
            marginBottom: 12,
            maxWidth: 780,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
          maxWidth: 780,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Result</div>

        {!picked ? (
          <div style={{ opacity: 0.8 }}>
            Click <b>Pick Next Title</b> to fetch the next READY row from your
            sheet.
          </div>
        ) : (
          <div style={{ lineHeight: 1.6 }}>
            <div>
              <b>row_id:</b> {picked.row_id}
            </div>
            {"title" in picked ? (
              <div>
                <b>title:</b> {picked.title}
              </div>
            ) : null}
            {"status" in picked ? (
              <div>
                <b>status:</b> {picked.status}
              </div>
            ) : null}
            {"picked_at" in picked ? (
              <div>
                <b>picked_at:</b> {picked.picked_at}
              </div>
            ) : null}
            {"video_id" in picked ? (
              <div>
                <b>video_id:</b> {picked.video_id || "(none)"}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, opacity: 0.75, maxWidth: 780 }}>
        <div>
          Backend endpoints used:
          <ul style={{ marginTop: 6 }}>
            <li>
              <code>GET /api/next-title</code>
            </li>
            <li>
              <code>POST /api/mark-used</code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
