/* eslint-disable no-unused-vars */
/* eslint-disable react/jsx-no-target-blank */

import React, { useState } from "react";
import Dashboard from "./Dashboard";

export default function App() {
  // Intentionally reserved for future ResumeAI control layers
  const [bozemski] = useState(null);
  const [intelligence] = useState("ResumeAI");
  const [security] = useState("locked");
  const [aiResponse] = useState(null);
  const [loading] = useState(false);

  // Reserved DeepSeek hook (future wiring)
  const askDeepSeek = async () => {
    return null;
  };

  return <Dashboard />;
}

