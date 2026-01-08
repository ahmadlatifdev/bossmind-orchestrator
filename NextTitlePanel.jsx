import React, { useState } from "react";
import { pickNextTitle, markTitleUsed } from "./bossmindRailwayClient";

export default function NextTitlePanel({ railwayBaseUrl }) {
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState("");

  const onPick = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await pickNextTitle(railwayBaseUrl);
      if (!res.found) {
        setPicked(null);
        setError(res.message || "No READY titles.");
      } else {
        setPicked(res.picked);
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const onMarkUsed = async () => {
    if (!picked?.sheet_row) return;
    setError("");
    setLoading(true);
    try {
      await markTitleUsed(railwayBaseUrl, { sheet_row: picked.sheet_row, video_id: "" });
      setPicked({ ...picked, status: "USED" });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, border: "1px solid #333", borderRadius: 12, maxWidth: 720 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={onPick} disabled={loading} style={{ padding: "10px 14px" }}>
          {loading ? "Working..." : "Pick Next Title"}
        </button>

        <button
          onClick={onMarkUsed}
          disabled={loading || !picked?.sheet_row || picked?.status === "USED"}
          style={{ padding: "10px 14px" }}
        >
          Mark Used
        </button>
      </div>

      {error ? <div style={{ marginTop: 12, color: "tomato" }}>{error}</div> : null}

      {picked ? (
        <div style={{ marginTop: 12 }}>
          <div><b>Sheet Row:</b> {picked.sheet_row}</div>
          <div><b>ID:</b> {picked.id}</div>
          <div><b>Language:</b> {picked.language}</div>
          <div><b>Status:</b> {picked.status}</div>
          <div style={{ marginTop: 10 }}><b>Title:</b></div>
          <div style={{ whiteSpace: "pre-wrap", background: "#111", padding: 12, borderRadius: 10 }}>
            {picked.title}
          </div>
        </div>
      ) : null}
    </div>
  );
}

