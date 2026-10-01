// ============================================================
// ROZY POS — Backup & Restore
// Exports/imports the entire local database as JSON
// ============================================================

import { db } from "./db";

// All tables to backup (order matters for restore — parent tables first)
export const BACKUP_TABLES = [
  "settings",
  "products",
  "categories",
  "shopStock",
  "sales",
  "saleItems",
  "customers",
  "orders",
  "orderItems",
  "expenses",
  "targets",
  "cashDrawer",
  "auditLog",
  "stockMovements",
  "wastage",
  "suppliers",
  "purchases",
  "purchaseItems",
  "payments",
  "batches",
  "users",
  "syncQueue",
];

// ---------- EXPORT ----------
export async function createBackup() {
  const backup = {
    version: 1,
    createdAt: new Date().toISOString(),
    createdAtTs: Date.now(),
    appName: "Rozy POS",
    data: {},
    counts: {},
  };

  for (const tableName of BACKUP_TABLES) {
    try {
      if (!db.tables.some((t) => t.name === tableName)) continue;
      const records = await db.table(tableName).toArray();
      backup.data[tableName] = records;
      backup.counts[tableName] = records.length;
    } catch (e) {
      console.warn(`Backup failed for ${tableName}:`, e.message);
    }
  }

  return backup;
}

export function downloadBackup(backup) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);

  const filename = `rozy-backup-${timestamp}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);

  return filename;
}

// ---------- RESTORE ----------
export async function restoreBackup(backup, options = {}) {
  const { merge = false } = options;

  if (!backup || !backup.data) {
    throw new Error("Invalid backup file");
  }

  const results = {};

  for (const tableName of BACKUP_TABLES) {
    if (!backup.data[tableName]) continue;
    if (!db.tables.some((t) => t.name === tableName)) continue;

    const records = backup.data[tableName];
    const table = db.table(tableName);

    try {
      if (!merge) {
        // Clear existing
        await table.clear();
      }
      // Insert records
      for (const record of records) {
        try {
          await table.put(record);
        } catch (e) {
          console.warn(`Skipped record in ${tableName}:`, e.message);
        }
      }
      results[tableName] = records.length;
    } catch (e) {
      console.warn(`Restore failed for ${tableName}:`, e.message);
      results[tableName] = 0;
    }
  }

  return results;
}

// ---------- FILE PICKER ----------
export function pickBackupFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";

    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        resolve({ backup, filename: file.name });
      } catch (err) {
        reject(new Error("Invalid backup file: " + err.message));
      }
    };

    input.click();
  });
}

// ---------- BACKUP STATS ----------
export async function getBackupStats() {
  const stats = {};
  let totalRecords = 0;

  for (const tableName of BACKUP_TABLES) {
    try {
      if (!db.tables.some((t) => t.name === tableName)) continue;
      const count = await db.table(tableName).count();
      stats[tableName] = count;
      totalRecords += count;
    } catch (e) {
      stats[tableName] = 0;
    }
  }

  return { stats, totalRecords };
}

// ---------- LAST BACKUP REMINDER ----------
const LAST_BACKUP_KEY = "rozy-pos-last-backup";

export function getLastBackupDate() {
  const ts = localStorage.getItem(LAST_BACKUP_KEY);
  return ts ? parseInt(ts) : null;
}

export function setLastBackupDate(ts = Date.now()) {
  localStorage.setItem(LAST_BACKUP_KEY, String(ts));
}

export function shouldRemindBackup() {
  const last = getLastBackupDate();
  if (!last) return true; // Never backed up
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - last > sevenDays;
}