export async function pickNextTitle(RAILWAY_BASE_URL) {
  const r = await fetch(`${RAILWAY_BASE_URL}/api/next-title`, { method: "GET" });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || "Failed to pick next title");
  return data;
}

export async function markTitleUsed(RAILWAY_BASE_URL, payload) {
  const r = await fetch(`${RAILWAY_BASE_URL}/api/mark-used`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || "Failed to mark used");
  return data;
}
