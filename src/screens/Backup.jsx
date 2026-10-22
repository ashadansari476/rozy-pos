import { useEffect, useState } from "react";
import { useApp } from "../stores/appStore";
import {
  createBackup, downloadBackup, restoreBackup, pickBackupFile,
  getBackupStats, getLastBackupDate, setLastBackupDate,
} from "../lib/backup";
import { fullReset, verifyReset } from "../lib/reset";
import { canAccessSettings } from "../lib/permissions";
import {
  Download, Upload, Database, Check, AlertTriangle,
  RefreshCw, FileText, Trash2, Shield, X,
} from "lucide-react";

export default function Backup() {
  const user = useApp((s) => s.user);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState(getLastBackupDate());
  const [restoreInfo, setRestoreInfo] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetProgress, setResetProgress] = useState(null);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const result = await getBackupStats();
    setStats(result);
  };

  if (!canAccessSettings(user)) {
    return (
      <div className="h-full flex items-center justify-center text-ink-muted">
        Only the owner can access backup settings.
      </div>
    );
  }

  const handleBackup = async () => {
    setBusy(true);
    try {
      const backup = await createBackup();
      const filename = downloadBackup(backup);
      setLastBackupDate();
      setLastBackup(Date.now());
      alert(
        `✅ Backup created!\n\n` +
        `File: ${filename}\n` +
        `Tables: ${Object.keys(backup.counts).length}\n` +
        `Total records: ${Object.values(backup.counts).reduce((a, b) => a + b, 0)}\n\n` +
        `Save this file somewhere safe.`
      );
    } catch (e) {
      alert("Backup failed: " + e.message);
    }
    setBusy(false);
  };

  const handleRestoreClick = async () => {
    if (!confirm(
      "⚠️ RESTORE WARNING ⚠️\n\n" +
      "This will REPLACE all current data with the contents of the backup file.\n\n" +
      "Recommendation: Download a backup first.\n\n" +
      "Continue?"
    )) return;

    try {
      const { backup, filename } = await pickBackupFile();
      setRestoreInfo({
        filename,
        createdAt: backup.createdAt,
        counts: backup.counts,
        backup,
      });
    } catch (e) {
      if (e.message !== "No file selected") {
        alert("Failed to read backup: " + e.message);
      }
    }
  };

  const confirmRestore = async () => {
    if (!restoreInfo?.backup) return;
    if (!confirm(
      `FINAL CONFIRMATION\n\n` +
      `Restoring from: ${restoreInfo.filename}\n\n` +
      `All current data will be replaced. This cannot be undone.\n\n` +
      `Proceed?`
    )) return;

    setBusy(true);
    try {
      const results = await restoreBackup(restoreInfo.backup, { merge: false });
      const total = Object.values(results).reduce((a, b) => a + b, 0);
      alert(`✅ Restore complete!\n\n${total} records restored.\n\nThe app will reload now.`);
      setRestoreInfo(null);
      setTimeout(() => location.reload(), 1000);
    } catch (e) {
      alert("Restore failed: " + e.message);
      setBusy(false);
    }
  };

  const handleFullReset = async () => {
    if (resetConfirm !== "RESET") {
      alert("Please type RESET to confirm");
      return;
    }

    setBusy(true);
    setResetProgress([]);

    try {
      await fullReset((msg) => {
        setResetProgress((prev) => [...prev, msg]);
      });

      const verify = await verifyReset();

      setResetProgress((prev) => [
        ...prev,
        `Total remaining: ${verify.totalRecords} records`,
        "Reset complete!",
      ]);
      setResetDone(true);
    } catch (e) {
      setResetProgress((prev) => [...prev, `ERROR: ${e.message}`]);
    }
    setBusy(false);
  };

  const finishReset = () => {
    alert("✅ Reset complete. The app will reload now with a fresh database.");
    location.reload();
  };

  const daysSinceBackup = lastBackup
    ? Math.floor((Date.now() - lastBackup) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl2 bg-primary-light text-primary flex items-center justify-center">
          <Database size={24} />
        </div>
        <div>
          <h1 className="font-serif text-2xl text-primary font-semibold">
            Backup & Restore
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Save your entire database as a file — works offline, no cloud needed
          </p>
        </div>
      </div>

      {/* Last backup status */}
      <div className={`card p-4 mb-5 ${
        daysSinceBackup === null || daysSinceBackup > 7
          ? "border-warning"
          : "border-success"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            daysSinceBackup === null || daysSinceBackup > 7
              ? "bg-warning text-white"
              : "bg-success text-white"
          }`}>
            {daysSinceBackup === null || daysSinceBackup > 7 ? (
              <AlertTriangle size={18} />
            ) : (
              <Check size={18} />
            )}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">
              {daysSinceBackup === null
                ? "Never backed up"
                : daysSinceBackup === 0
                ? "Backed up today"
                : `${daysSinceBackup} day${daysSinceBackup > 1 ? "s" : ""} since last backup`}
            </div>
            <div className="text-xs text-ink-muted">
              {daysSinceBackup === null || daysSinceBackup > 7
                ? "Recommended: back up weekly"
                : "You're up to date ✅"}
            </div>
          </div>
        </div>
      </div>

      {/* Database stats */}
      {stats && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-ink mb-4 flex items-center gap-2">
            <Database size={16} className="text-primary" /> Current Data
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-bg/45 rounded-xl p-3">
              <div className="text-xs text-ink-muted uppercase">Sales</div>
              <div className="font-mono text-lg font-bold text-primary">
                {stats.stats.sales || 0}
              </div>
            </div>
            <div className="bg-bg/45 rounded-xl p-3">
              <div className="text-xs text-ink-muted uppercase">Products</div>
              <div className="font-mono text-lg font-bold text-primary">
                {stats.stats.products || 0}
              </div>
            </div>
            <div className="bg-bg/45 rounded-xl p-3">
              <div className="text-xs text-ink-muted uppercase">Customers</div>
              <div className="font-mono text-lg font-bold text-primary">
                {stats.stats.customers || 0}
              </div>
            </div>
            <div className="bg-bg/45 rounded-xl p-3">
              <div className="text-xs text-ink-muted uppercase">Total Records</div>
              <div className="font-mono text-lg font-bold text-accent">
                {stats.totalRecords}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup + Restore */}
      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <div className="card p-5">
          <div className="w-12 h-12 rounded-xl bg-success/10 text-success flex items-center justify-center mb-3">
            <Download size={22} />
          </div>
          <h3 className="font-serif text-lg font-semibold mb-1">Download Backup</h3>
          <p className="text-xs text-ink-muted mb-4">
            Saves everything as a JSON file.
          </p>
          <button onClick={handleBackup} disabled={busy} className="btn-primary w-full">
            {busy ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Creating...
              </>
            ) : (
              <>
                <Download size={16} /> Create Backup Now
              </>
            )}
          </button>
        </div>

        <div className="card p-5">
          <div className="w-12 h-12 rounded-xl bg-warning/10 text-warning flex items-center justify-center mb-3">
            <Upload size={22} />
          </div>
          <h3 className="font-serif text-lg font-semibold mb-1">Restore from Backup</h3>
          <p className="text-xs text-ink-muted mb-4">
            Restore database from a backup file.
          </p>
          <button onClick={handleRestoreClick} disabled={busy} className="btn-outline w-full">
            <Upload size={16} /> Select Backup File
          </button>
        </div>
      </div>

      {/* Restore info panel */}
      {restoreInfo && (
        <div className="card p-5 mb-5 border-warning">
          <h3 className="font-semibold text-warning mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> Confirm Restore
          </h3>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-ink-muted">File:</span>
              <span className="font-mono text-xs">{restoreInfo.filename}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Backup date:</span>
              <span>{new Date(restoreInfo.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRestoreInfo(null)} className="btn-outline flex-1">
              Cancel
            </button>
            <button onClick={confirmRestore} disabled={busy} className="btn-primary flex-1">
              {busy ? "Restoring..." : "Confirm Restore"}
            </button>
          </div>
        </div>
      )}

      {/* ============ DANGER ZONE ============ */}
      <div className="card p-5 mt-6" style={{ borderColor: "#C0392B" }}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center flex-shrink-0">
            <Trash2 size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-lg font-semibold text-danger">
              Danger Zone — Reset All Data
            </h3>
            <p className="text-xs text-ink-muted mt-1">
              Permanently deletes ALL products, sales, customers, orders, expenses, and other data.
              Keeps only shop settings and PIN.
            </p>
          </div>
        </div>

        {!showReset ? (
          <button
            onClick={() => setShowReset(true)}
            className="btn-outline text-danger hover:bg-danger hover:text-white"
            style={{ borderColor: "#C0392B" }}
          >
            <Trash2 size={16} /> Start Reset Process
          </button>
        ) : (
          <div className="bg-danger/5 border border-danger/30 rounded-xl p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle size={16} className="text-danger flex-shrink-0 mt-0.5" />
              <div className="text-xs text-ink">
                <b>This will permanently delete everything.</b> You should download a backup first.
              </div>
            </div>

            <label className="label text-danger">
              Type <b>RESET</b> to confirm:
            </label>
            <input
              type="text"
              className="input font-mono"
              placeholder="Type RESET"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value.toUpperCase())}
              disabled={busy || resetDone}
              autoFocus
            />

            {resetProgress && (
              <div className="mt-3 bg-black/5 rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-[10px]">
                {resetProgress.map((line, i) => (
                  <div key={i} className="text-ink-muted">{line}</div>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              {!resetDone ? (
                <>
                  <button
                    onClick={() => {
                      setShowReset(false);
                      setResetConfirm("");
                      setResetProgress(null);
                    }}
                    disabled={busy}
                    className="btn-outline flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFullReset}
                    disabled={busy || resetConfirm !== "RESET"}
                    className="btn-primary flex-1 bg-danger"
                    style={{ background: "linear-gradient(180deg, #C0392B 0%, #8B1E1E 100%)" }}
                  >
                    {busy ? "Resetting..." : "Delete Everything"}
                  </button>
                </>
              ) : (
                <button onClick={finishReset} className="btn-primary flex-1">
                  <Check size={16} /> Done — Reload App
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card p-5 mt-5">
        <h3 className="font-semibold text-ink mb-3 flex items-center gap-2">
          <FileText size={16} className="text-primary" /> Info
        </h3>
        <div className="space-y-2 text-sm text-ink-muted">
          <div className="flex gap-2">
            <Check size={14} className="text-success mt-0.5 flex-shrink-0" />
            <span>Backup downloads ALL data as a JSON file — works offline.</span>
          </div>
          <div className="flex gap-2">
            <Check size={14} className="text-success mt-0.5 flex-shrink-0" />
            <span>Restore brings back data on any device (new tablet, after reset).</span>
          </div>
          <div className="flex gap-2">
            <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
            <span>Reset is permanent. Always download a backup first.</span>
          </div>
        </div>
      </div>
    </div>
  );
}