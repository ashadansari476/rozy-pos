import { useEffect, useState } from "react";
import { useApp } from "../stores/appStore";
import {
  getSupabaseUrl, getSupabaseKey, setSupabaseConfig,
  clearSupabaseConfig, testConnection, getSyncStatus,
} from "../lib/supabase";
import { Cloud, Check, X, RefreshCw, Save, AlertTriangle } from "lucide-react";
import { fullSync } from "../lib/syncEngine";

export default function SyncSettings() {
  const user = useApp((s) => s.user);
  const [url, setUrl] = useState(getSupabaseUrl());
  const [key, setKey] = useState(getSupabaseKey());
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    refreshStatus();
  }, []);

  const refreshStatus = async () => {
    const s = await getSyncStatus();
    setStatus(s);
  };

  const handleSave = async () => {
    if (!url.trim() || !key.trim()) {
      alert("Both URL and Key are required");
      return;
    }
    setSupabaseConfig(url.trim(), key.trim());
    setTesting(true);
    const result = await testConnection();
    setTesting(false);
    await refreshStatus();
    if (result.ok) {
      alert("✅ Connected to Supabase!");
    } else {
      alert("❌ Connection failed: " + result.error);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const result = await testConnection();
    setTesting(false);
    await refreshStatus();
    alert(result.ok ? "✅ Connection OK" : "❌ " + result.error);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await fullSync();
      setSyncResult(result);
      alert(
        `✅ Sync complete!\n\n` +
        `Products pulled: ${result.products.pulled}\n` +
        `Products updated: ${result.products.updated}\n` +
        `Products pushed: (all local)`
      );
    } catch (e) {
      alert("Sync failed: " + e.message);
    }
    setSyncing(false);
  };

  const handleDisconnect = () => {
    if (!confirm("Disconnect from cloud sync? Local data stays.")) return;
    clearSupabaseConfig();
    setUrl("");
    setKey("");
    refreshStatus();
  };

  if (user.role !== "owner") {
    return (
      <div className="h-full flex items-center justify-center text-ink-muted">
        Only the owner can configure cloud sync.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl2 bg-primary-light text-primary flex items-center justify-center">
          <Cloud size={24} />
        </div>
        <div>
          <h1 className="font-serif text-2xl text-primary font-semibold">
            Cloud Sync
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Sync products between your shops via Supabase
          </p>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div className={`card p-4 mb-5 ${
          status.connected ? "border-success" : status.enabled ? "border-warning" : ""
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              status.connected ? "bg-success text-white" :
              status.enabled ? "bg-warning text-white" : "bg-border text-ink-muted"
            }`}>
              {status.connected ? <Check size={18} /> :
               status.enabled ? <AlertTriangle size={18} /> : <X size={18} />}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">
                {status.connected ? "Connected to cloud" :
                 status.enabled ? "Configured but not reachable" :
                 "Not configured — running local only"}
              </div>
              {status.error && (
                <div className="text-xs text-danger mt-0.5">{status.error}</div>
              )}
            </div>
            <button onClick={refreshStatus} className="btn-outline py-1.5 px-3 text-xs">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>
      )}

      {/* Config Form */}
      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-ink mb-4">Supabase Credentials</h2>

        <div className="space-y-4">
          <div>
            <label className="label">Project URL</label>
            <input
              className="input font-mono text-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
            />
            <div className="text-xs text-ink-muted mt-1">
              Find in Supabase → Project Settings → Data API
            </div>
          </div>

          <div>
            <label className="label">Publishable Key</label>
            <textarea
              className="input font-mono text-xs"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sb_publishable_..."
              rows="3"
            />
            <div className="text-xs text-ink-muted mt-1">
              Find in Supabase → Project Settings → API Keys → Publishable key
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5 pt-4 border-t border-border flex-wrap">
          <button onClick={handleSave} disabled={testing} className="btn-primary">
            <Save size={14} /> {testing ? "Testing..." : "Save & Test"}
          </button>
          <button onClick={handleTest} disabled={testing || !url || !key} className="btn-outline">
            <RefreshCw size={14} /> Test Connection
          </button>
          {status?.enabled && (
            <button onClick={handleDisconnect} className="btn-outline text-danger">
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Sync Now */}
      {status?.connected && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-ink mb-2">Manual Sync</h2>
          <p className="text-xs text-ink-muted mb-4">
            Push all local products to cloud, then pull any new products from other shops.
            Run this after adding many products at once.
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-primary"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>

          {syncResult && (
            <div className="bg-success/10 rounded-xl p-3 mt-4 text-sm">
              <div className="font-semibold text-success mb-1">Last sync result:</div>
              <div className="text-xs text-ink">
                Pulled: {syncResult.products.pulled} new · {syncResult.products.updated} updated
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="card p-5">
        <h2 className="font-semibold text-ink mb-3">How Sync Works</h2>
        <div className="space-y-2 text-sm text-ink-muted">
          <div className="flex gap-2">
            <Check size={14} className="text-success mt-0.5 flex-shrink-0" />
            <span><b>Products & Categories</b> sync both ways — added once, appears everywhere</span>
          </div>
          <div className="flex gap-2">
            <X size={14} className="text-danger mt-0.5 flex-shrink-0" />
            <span><b>Stock</b> stays separate per shop — Rozy's count is Rozy's own</span>
          </div>
          <div className="flex gap-2">
            <X size={14} className="text-danger mt-0.5 flex-shrink-0" />
            <span><b>Sales, customers, orders</b> are per-shop and stay local</span>
          </div>
        </div>
      </div>
    </div>
  );
}