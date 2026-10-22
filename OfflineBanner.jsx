import { useEffect, useState } from "react";
import { WifiOff, Cloud, RefreshCw, AlertTriangle } from "lucide-react";
import { isOnline, probeConnection, getPendingCount } from "../../lib/offline";
import { useSync } from "../../stores/syncStore";

export default function OfflineBanner() {
  const [online, setOnline] = useState(isOnline());
  const [probe, setProbe] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const syncStore = useSync();

  // Track online/offline
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Probe connection quality periodically
  useEffect(() => {
    const run = async () => {
      const result = await probeConnection();
      setProbe(result);
      const count = await getPendingCount();
      setPendingCount(count);
    };

    run();
    const interval = setInterval(run, 30000); // every 30 seconds

    // Also refresh when a sync completes
    const syncHandler = () => run();
    window.addEventListener("sync-complete", syncHandler);

    return () => {
      clearInterval(interval);
      window.removeEventListener("sync-complete", syncHandler);
    };
  }, [online]);

  // Nothing to show if everything is fine
  if (online && (!probe || probe.quality === "excellent" || probe.quality === "good")) {
    if (pendingCount > 0) {
      // Small pending badge
      return (
        <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-warning/10 text-warning text-xs">
          <RefreshCw size={12} className="animate-spin" />
          <span>{pendingCount} pending item{pendingCount > 1 ? "s" : ""} to sync</span>
          <button
            onClick={() => syncStore.sync()}
            className="underline font-semibold ml-1"
          >
            Sync now
          </button>
        </div>
      );
    }
    return null;
  }

  // Offline banner
  if (!online) {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-2 bg-danger text-white text-xs font-semibold">
        <WifiOff size={14} />
        <span>You're offline — the app still works. Data will sync when back online.</span>
        {pendingCount > 0 && (
          <span className="bg-white/20 px-2 py-0.5 rounded-full">
            {pendingCount} queued
          </span>
        )}
      </div>
    );
  }

  // Server unreachable (like Supabase down)
  if (probe?.quality === "unreachable" || probe?.quality === "unstable") {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-2 bg-warning text-white text-xs font-semibold">
        <AlertTriangle size={14} />
        <span>Cloud sync is having trouble. Your work is safe — it will sync when the server is back.</span>
        {pendingCount > 0 && (
          <span className="bg-white/20 px-2 py-0.5 rounded-full">
            {pendingCount} queued
          </span>
        )}
      </div>
    );
  }

  // Slow connection
  if (probe?.quality === "slow") {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-warning/10 text-warning text-xs">
        <Cloud size={12} />
        <span>Slow connection — {probe.latency}ms</span>
      </div>
    );
  }

  return null;
}