// main.jsx
// React entry point – mounts the dashboard into the DOM

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Optional global stylesheet (if you have one)
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
