import React from "react";

export default function Sidebar({ onSelect, active }) {
  return (
    <div
      style={{
        width: "230px",
        background: "#000",
        color: "#fff",
        paddingTop: "25px",
        borderRight: "1px solid #222",
      }}
    >

      <h2 style={{ textAlign: "center", marginBottom: "25px" }}>BossMind</h2>

      <button
        onClick={() => onSelect("missions")}
        style={{
          width: "100%",
          padding: "12px",
          background: active === "missions" ? "#0f0" : "#111",
          color: active === "missions" ? "#000" : "#fff",
          border: "none",
          marginBottom: "5px",
          cursor: "pointer",
          fontSize: "15px",
        }}
      >
        🚀 Run Mission
      </button>
    </div>
  );
}
