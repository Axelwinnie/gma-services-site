import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../../shell/shell.css";
import "./extract.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
