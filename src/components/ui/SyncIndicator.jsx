import { useState, useEffect } from "react";
import { Cloud, CloudOff, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { useSync } from "../../stores/syncStore";
import { isOnline } from "../../lib/syncEngine";

export default function SyncIndicator() {
  const { status, lastSync, sync } = useSync();
  const [online, setOnline] = useState(isOnline());

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

  const getDisplay = () => {
    if (!online) {
      return {
        icon: CloudOff,
        color: "text-danger",
        bg: "bg-danger/10",
        label: "Offline",
      };
    }
    if (status === "syncing") {
      return {
        icon: RefreshCw,
        color: "text-warning",
        bg: "bg-warning/10",
        label: "Syncing",
        spin: true,
      };
    }
    if (status === "success") {
      return {
        icon: Check,
        color: "text-success",
        bg: "bg-success/10",
        label: "Synced",
      };
    }
    if (status === "error") {
      return {
        icon: AlertTriangle,
        color: "text-danger",
        bg: "bg-danger/10",
        label: "Sync failed",
      };
    }
    return {
      icon: Cloud,
      color: "text-success",
      bg: "bg-success/10",
      label: "Cloud",
    };
  };

  const { icon: Icon, color, bg, label, spin } = getDisplay();

  const timeSince = lastSync
    ? formatTimeAgo(lastSync)
    : "Never";

  return (
    <button
      onClick={() => sync()}
      title={`Last synced: ${timeSince} · Click to sync now`}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${bg} ${color} 
                  hover:opacity-80 transition text-xs font-semibold`}
    >
      <Icon size={12} className={spin ? "animate-spin" : ""} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}