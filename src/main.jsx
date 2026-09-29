import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import "./i18n";
import { bootstrapSettings, migrateExistingDataToRozy } from "./lib/db";
import ToastContainer from "./components/ui/Toast";

(async () => {
  await bootstrapSettings();
  await migrateExistingDataToRozy();

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
        <ToastContainer />
      </BrowserRouter>
    </React.StrictMode>
  );
})();