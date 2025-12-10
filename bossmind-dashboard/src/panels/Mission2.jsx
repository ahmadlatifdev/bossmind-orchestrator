// src/panels/Mission2.jsx
// Mission Control II – wired to BossMind API

import { useState } from "react";

const operations = [
  {
    key: "tasks",
    label: "Run Sequence",
    description: "Load mission-1-tasks.json from the BossMind engine.",
  },
  {
    key: "category-pages",
    label: "Generate Outcome Report",
    description: "Preview the generated category pages structure.",
  },
  {
    key: "products",
    label: "Sync Intelligence Nodes",
    description: "Sync mission-1-products.json into the runtime view.",
  },
  {
    key: "agents-progress",
    label: "AI Response Monitor",
    description: "Check mission-1-agents-progress.json for status.",
  },
];

export default function Mission2() {
  const [activeKey, setActiveKey] = useState(null);
  const [output, setOutput] = useState("");

  async function runOperation(opKey) {
    setActiveKey(opKey);
    setOutput("Loading from BossMind API…");

    try {
      const res = await fetch(`http://localhost:5000/api/mission1/${opKey}`);
      const json = await res.json();
      setOutput(JSON.stringify(json, null, 2));
    } catch (err) {
      setOutput("⚠ Failed to reach BossMind API on http://localhost:5000");
    }
  }

  return (
    <div
      style={{
        padding: "40px 0 80px",
        minHeight: "60vh",
        color: "white",
      }}
    >
      <h2 style={{ fontSize: 32, marginBottom: 8 }}>Mission Control II</h2>
      <p style={{ marginBottom: 40 }}>
        Execute &amp; monitor Bossmind AI tasks here.
      </p>

      {/* Operations panel */}
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          background: "#111",
          borderRadius: 16,
          padding: 30,
          border: "1px solid #333",
          textAlign: "left",
        }}
      >
        <h3 style={{ marginBottom: 20, textAlign: "center" }}>
          Available Operations
        </h3>

        {operations.map((op) => (
          <button
            key={op.key}
            onClick={() => runOperation(op.key)}
            style={{
              width: "100%",
              margin: "8px 0",
              padding: "12px 18px",
              borderRadius: 8,
              border:
                activeKey === op.key ? "1px solid gold" : "1px solid #333",
              background: activeKey === op.key ? "#181200" : "#1a1a1a",
              color: "white",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 600 }}>{op.label}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{op.description}</div>
          </button>
        ))}
      </div>

      {/* Result panel */}
      <div
        style={{
          maxWidth: 900,
          margin: "30px auto 0",
          background: "#050505",
          borderRadius: 12,
          padding: 20,
          border: "1px solid #222",
          textAlign: "left",
        }}
      >
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Mission Output</div>
        <pre
          style={{
            margin: 0,
            maxHeight: 320,
            overflow: "auto",
            fontSize: 13,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
          }}
        >
          {output || "Select an operation to load JSON from the BossMind server."}
        </pre>
      </div>
    </div>
  );
}
