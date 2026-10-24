import { useEffect, useState } from "react";
import { useApp } from "../stores/appStore";
import {
  getSupabaseUrl, getSupabaseKey, setSupabaseConfig,
  clearSupabaseConfig, testConnection, getSyncStatus,
} from "../lib/supabase";
import { Cloud, Check, X, RefreshCw, Save, AlertTriangle } from "lucide-react";
import { fullSync, processQueue, getSyncQueueStatus, retryFailedSyncOperation } from "../lib/syncEngine";
import { runReadOnlyCloudDiagnostics } from "../lib/syncDiagnostics";
import { getSyncAccount, signInSync, signOutSync } from "../lib/supabaseAuth";

export default function SyncSettings() {
  const user = useApp((s) => s.user);
  const [url, setUrl] = useState(getSupabaseUrl());
  const [key, setKey] = useState(getSupabaseKey());
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [account, setAccount] = useState(getSyncAccount());
  const [email, setEmail] = useState(getSyncAccount()?.email || "");
  const [pass, setPass] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState(null);

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
        `Pushed: ${result.pushed || 0} records\n` +
        `Pulled: ${result.pulled || 0} records\n` +
        `Updated: ${result.updated || 0} records`
      );
    } catch (e) {
      alert("Sync failed: " + e.message);
    }
    setSyncing(false);
  };

  const handleDiagnose = async () => {
    setDiagnosing(true);
    setDiagnosis(null);
    try {
      const result = await runReadOnlyCloudDiagnostics();
      setDiagnosis(result);
    } catch (error) {
      setDiagnosis({ ok: false, passed: 0, total: 0, errors: [error.message] });
    } finally {
      setDiagnosing(false);
    }
  };

  const handleRetryFailed = async () => {
    const status = await getSyncQueueStatus();
    if (!status.failed) {
      alert("No failed sync operations to retry. Pending operations are preserved.");
      return;
    }
    if (!confirm(`Retry ${status.failed} failed sync operation(s)? No unsynced data will be deleted.`)) return;
    setSyncing(true);
    try {
      const { db } = await import("../lib/db");
      // Read full failure records privately; the status summary is display-only.
      const failed = await db.syncQueue.where("status").equals("failed").toArray();
      for (const op of failed) await retryFailedSyncOperation(op.id);
      const result = await processQueue();
      alert(`Retry finished. Processed: ${result.processed}, failed: ${result.failed}. Other pending operations remain queued.`);
      await refreshStatus();
    } catch (e) {
      alert("Retry failed: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !pass) {
      alert("Enter the sync account email and password");
      return;
    }
    setSigningIn(true);
    try {
      await signInSync(email, pass);
      setAccount(getSyncAccount());
      setPass("");
      await refreshStatus();
      alert("✅ Signed in. This device will now sync as " + email.trim());
    } catch (e) {
      alert("❌ " + e.message);
    }
    setSigningIn(false);
  };

  const handleSignOut = async () => {
    signOutSync();
    setAccount(null);
    await refreshStatus();
  };

  const handleDisconnect = () => {
    if (!confirm("Disconnect from cloud sync? Local data stays.")) return;
    signOutSync();
    setAccount(null);
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
            Sync data between devices via Supabase
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
              Just the base URL — no /rest/v1 at the end
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

      {/* Sync account (protects the cloud data) */}
      {status?.enabled && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-ink mb-1">Sync account</h2>
          <p className="text-xs text-ink-muted mb-4">
            {account
              ? `Signed in as ${account.email}. Your cloud data is protected by this login.`
              : "Not signed in. Cloud access requires the shared Supabase Auth owner account configured for both bakeries. The publishable key alone does not grant access."}
          </p>
          {account ? (
            <button onClick={handleSignOut} className="btn-outline">Sign out of sync account</button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="sync-email">Account email</label>
                <input
                  id="sync-email"
                  className="input"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="sync-pass">Account password</label>
                <input
                  id="sync-pass"
                  className="input"
                  type="password"
                  autoComplete="off"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                />
              </div>
              <button onClick={handleSignIn} disabled={signingIn} className="btn-primary">
                {signingIn ? "Signing in..." : "Sign in"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Standard sync + safe retry */}
      {status?.connected && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-ink mb-2">Sync</h2>
          <p className="text-xs text-ink-muted mb-3">
            Read-only cloud diagnostics verify authenticated REST access to both bakeries
            and confirm anonymous reads are blocked. No test records are created.
          </p>
          <button
            onClick={handleDiagnose}
            disabled={diagnosing || syncing}
            className="btn-outline mb-3"
          >
            <RefreshCw size={14} /> {diagnosing ? "Running checks..." : "Run Read-Only Cloud Diagnostics"}
          </button>
          {diagnosis && (
            <div className="border border-border rounded-xl p-3 mb-3 text-xs">
              <div className="font-semibold">
                {diagnosis.ok ? "✅ PASS" : "❌ CHECK FAILED"} — {diagnosis.passed}/{diagnosis.total} checks
              </div>
              {diagnosis.errors?.map((error, index) => (
                <div key={index} className="mt-1 break-words">{error}</div>
              ))}
            </div>
          )}
          <p className="text-xs text-ink-muted mb-4">
            <b>Sync Now:</b> Process queued changes and pull shop records; it does not upload all historical local records.<br />
            <b>Retry Failed:</b> Retry failed operations without deleting pending sales, orders or payments.
          </p>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-primary"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync Now"}
            </button>

            <button
              onClick={handleRetryFailed}
              disabled={syncing}
              className="btn-outline"
              style={{ borderColor: "#E67E22", color: "#E67E22" }}
            >
              <RefreshCw size={14} />
              Retry Failed Sync
            </button>
          </div>

          {syncResult && (
            <div className="bg-success/10 rounded-xl p-3 mt-4 text-sm">
              <div className="font-semibold text-success mb-1">Last sync result:</div>
              <div className="text-xs text-ink">
                Pushed: {syncResult.pushed || 0} · Pulled: {syncResult.pulled || 0} · Updated: {syncResult.updated || 0}
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
            <span><b>Products & Categories</b> sync both ways between devices</span>
          </div>
          <div className="flex gap-2">
            <Check size={14} className="text-success mt-0.5 flex-shrink-0" />
            <span><b>Sales, Customers, Orders</b> sync both ways</span>
          </div>
          <div className="flex gap-2">
            <X size={14} className="text-danger mt-0.5 flex-shrink-0" />
            <span><b>Stock</b> is per-shop — Rozy's count is Rozy's own</span>
          </div>
        </div>
      </div>
    </div>
  );
}