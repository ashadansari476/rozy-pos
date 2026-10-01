import { useEffect, useState } from "react";
import { useApp } from "../stores/appStore";
import {
  createBackup, downloadBackup, restoreBackup, pickBackupFile,
  getBackupStats, getLastBackupDate, setLastBackupDate,
} from "../lib/backup";
import { canAccessSettings } from "../lib/permissions";
import {
  Download, Upload, Database, Check, AlertTriangle,
  RefreshCw, FileText, Clock,
} from "lucide-react";

export default function Backup() {
  const user = useApp((s) => s.user);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState(getLastBackupDate());
  const [restoreInfo, setRestoreInfo] = useState(null);

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
        `Save this file somewhere safe (Google Drive, USB, WhatsApp).`
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
      "Current data will be lost!\n\n" +
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
      `Restoring from: ${restoreInfo.filename}\n` +
      `Backup date: ${new Date(restoreInfo.createdAt).toLocaleString()}\n\n` +
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-bg rounded-xl p-3">
              <div className="text-xs text-ink-muted uppercase">Sales</div>
              <div className="font-mono text-lg font-bold text-primary">
                {stats.stats.sales || 0}
              </div>
            </div>
            <div className="bg-bg rounded-xl p-3">
              <div className="text-xs text-ink-muted uppercase">Products</div>
              <div className="font-mono text-lg font-bold text-primary">
                {stats.stats.products || 0}
              </div>
            </div>
            <div className="bg-bg rounded-xl p-3">
              <div className="text-xs text-ink-muted uppercase">Customers</div>
              <div className="font-mono text-lg font-bold text-primary">
                {stats.stats.customers || 0}
              </div>
            </div>
            <div className="bg-bg rounded-xl p-3">
              <div className="text-xs text-ink-muted uppercase">Total Records</div>
              <div className="font-mono text-lg font-bold text-accent">
                {stats.totalRecords}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Backup */}
        <div className="card p-5">
          <div className="w-12 h-12 rounded-xl bg-success/10 text-success flex items-center justify-center mb-3">
            <Download size={22} />
          </div>
          <h3 className="font-serif text-lg font-semibold mb-1">Download Backup</h3>
          <p className="text-xs text-ink-muted mb-4">
            Saves a complete copy of your database (sales, customers, orders, everything) as a JSON file.
          </p>
          <button
            onClick={handleBackup}
            disabled={busy}
            className="btn-primary w-full"
          >
            {busy ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Creating backup...
              </>
            ) : (
              <>
                <Download size={16} /> Create Backup Now
              </>
            )}
          </button>
          <div className="text-xs text-ink-muted mt-3 text-center">
            💡 Save to Google Drive, USB, or email to yourself
          </div>
        </div>

        {/* Restore */}
        <div className="card p-5">
          <div className="w-12 h-12 rounded-xl bg-warning/10 text-warning flex items-center justify-center mb-3">
            <Upload size={22} />
          </div>
          <h3 className="font-serif text-lg font-semibold mb-1">Restore from Backup</h3>
          <p className="text-xs text-ink-muted mb-4">
            Restores your database from a previously saved backup file. Use on new devices or after a reset.
          </p>
          <button
            onClick={handleRestoreClick}
            disabled={busy}
            className="btn-outline w-full"
          >
            <Upload size={16} /> Select Backup File
          </button>
          <div className="text-xs text-warning mt-3 text-center">
            ⚠️ This will REPLACE all current data
          </div>
        </div>
      </div>

      {/* Restore info panel */}
      {restoreInfo && (
        <div className="card p-5 mt-5 border-warning">
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
            <div className="flex justify-between">
              <span className="text-ink-muted">Total records:</span>
              <span className="font-mono font-semibold">
                {Object.values(restoreInfo.counts || {}).reduce((a, b) => a + b, 0)}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRestoreInfo(null)} className="btn-outline flex-1">
              Cancel
            </button>
            <button
              onClick={confirmRestore}
              disabled={busy}
              className="btn-primary flex-1"
              style={{ background: "linear-gradient(180deg, #E67E22 0%, #C0392B 100%)" }}
            >
              {busy ? "Restoring..." : "Confirm Restore"}
            </button>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="card p-5 mt-5">
        <h3 className="font-semibold text-ink mb-3 flex items-center gap-2">
          <FileText size={16} className="text-primary" /> How It Works
        </h3>
        <div className="space-y-2 text-sm text-ink-muted">
          <div className="flex gap-2">
            <Check size={14} className="text-success mt-0.5 flex-shrink-0" />
            <span><b>Backup</b> downloads a JSON file with everything — sales, customers, orders, stock, all.</span>
          </div>
          <div className="flex gap-2">
            <Check size={14} className="text-success mt-0.5 flex-shrink-0" />
            <span><b>Works offline</b> — no internet needed. Save to USB, Google Drive, or WhatsApp to yourself.</span>
          </div>
          <div className="flex gap-2">
            <Check size={14} className="text-success mt-0.5 flex-shrink-0" />
            <span><b>Restore</b> on any device — new tablet, after reset, or after data loss.</span>
          </div>
          <div className="flex gap-2">
            <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
            <span><b>Do weekly</b> — set a reminder. Takes 30 seconds.</span>
          </div>
        </div>
      </div>
    </div>
  );
}