import React from "react";

export default function LivePreview() {
  return (
    <div
      style={{
        height: "100%",
        minHeight: "260px",
        borderRadius: "16px",
        border: "1px solid rgba(120,120,140,0.7)",
        padding: "24px",
        background:
          "radial-gradient(circle at top, rgba(74,222,128,0.12), transparent 55%)",
        color: "#e5e7eb",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "10px",
        textAlign: "center",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "8px 16px",
          borderRadius: "999px",
          border: "1px solid rgba(161,161,170,0.5)",
          fontSize: "12px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            marginRight: "8px",
            background:
              "radial-gradient(circle at center, #22c55e, rgba(34,197,94,0.05))",
            boxShadow: "0 0 16px rgba(34,197,94,0.7)",
          }}
        />
        Live BossMind Preview
      </div>

      <h1 style={{ fontSize: "26px", fontWeight: 600, marginTop: "8px" }}>
        Luxury Orchestrator Workspace
      </h1>

      <p style={{ maxWidth: "520px", fontSize: "14px", opacity: 0.85 }}>
        This is your local **BossMind** dashboard preview.  
        The left sidebar will grow into missions and AI controls, and this
        panel will render the live state from DeepSeek, Supabase and your
        AI Builder.
      </p>

      <div style={{ marginTop: "16px", fontSize: "12px", opacity: 0.7 }}>
        Connected to: <b>localhost:3000</b> &nbsp;|&nbsp; Mode: <b>DEV</b>
      </div>
    </div>
  );
}
