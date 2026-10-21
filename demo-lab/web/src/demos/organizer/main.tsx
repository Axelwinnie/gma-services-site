import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./organizer.css";

// Same theme start-up as the real program (file_organizer/static/app.js:5-8): a saved choice wins, else the OS setting.
try {
  const saved = localStorage.getItem("fo-theme");
  if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);
} catch { /* private window */ }

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
