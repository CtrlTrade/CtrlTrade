import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";

const root = document.getElementById("root")!;

createRoot(root).render(<HelmetProvider><App /></HelmetProvider>);
