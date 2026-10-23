import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import "./i18n";
import { bootstrapSettings, migrateExistingDataToRozy } from "./lib/db";

(async () => {
  await bootstrapSettings();
  await migrateExistingDataToRozy();

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );

  // Register service worker for offline support
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("✅ Service Worker registered");
          // look for a new version when the app is reopened and every 30 minutes
          const check = () => reg.update().catch(() => {});
          document.addEventListener("visibilitychange", () => {
            if (!document.hidden) check();
          });
          setInterval(check, 30 * 60 * 1000);
          // tell the user when a new version has been downloaded
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                window.dispatchEvent(new Event("rozy-update-ready"));
              }
            });
          });
        })
        .catch((err) => console.warn("SW registration failed:", err));
    });
  }
})();