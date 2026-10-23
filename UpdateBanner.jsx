import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// Shows when a new version of the app has been downloaded in the background.
// Tapping it reloads the page (you will have to log in again).
export default function UpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const on = () => setReady(true);
    window.addEventListener("rozy-update-ready", on);
    return () => window.removeEventListener("rozy-update-ready", on);
  }, []);

  if (!ready) return null;

  return (
    <button
      onClick={() => window.location.reload()}
      className="fixed left-1/2 -translate-x-1/2 z-[5001] btn-primary shadow-warmH"
      style={{ bottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}
    >
      <RefreshCw size={16} /> New version ready. Tap to update
    </button>
  );
}
