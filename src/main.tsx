import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "@/lib/pwa/register-service-worker";

const pwaUpdate = registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App pwaUpdate={pwaUpdate} />
  </StrictMode>,
);
