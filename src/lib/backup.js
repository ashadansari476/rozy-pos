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
    if (!db.tables.some((t) => t.name === tableName)) {
      throw new Error(`Backup incomplete: database table "${tableName}" is missing`);
    }
    try {
      const records = await db.table(tableName).toArray();
      backup.data[tableName] = records;
      backup.counts[tableName] = records.length;
    } catch (e) {
      // Never present a partial export as a valid backup.
      throw new Error(`Backup failed for ${tableName}: ${e?.message || e}`);
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

  if (!backup || typeof backup !== "object" || !backup.data || typeof backup.data !== "object" || Array.isArray(backup.data)) {
    throw new Error("Invalid backup file: expected a Rozy POS backup with a data object");
  }
  if (backup.appName && backup.appName !== "Rozy POS") {
    throw new Error("This backup does not appear to belong to Rozy POS");
  }

  const availableTables = BACKUP_TABLES.filter((name) =>
    db.tables.some((table) => table.name === name)
  );
  for (const tableName of availableTables) {
    const records = backup.data[tableName];
    if (records === undefined) {
      if (!merge) {
        throw new Error(`Cannot replace local data: backup is missing the "${tableName}" table. Use a complete backup.`);
      }
      continue;
    }
    if (!Array.isArray(records) || records.some((record) => !record || typeof record !== "object" || Array.isArray(record))) {
      throw new Error(`Invalid backup: "${tableName}" must contain an array of records`);
    }
    if (backup.counts && backup.counts[tableName] !== undefined && backup.counts[tableName] !== records.length) {
      throw new Error(`Invalid backup: record count for "${tableName}" does not match`);
    }
  }

  const tablesToRestore = availableTables.filter((name) => Array.isArray(backup.data[name]));
  const results = {};

  // Validate first, then apply all table changes atomically. If one write fails, Dexie
  // rolls back the transaction instead of leaving a half-restored database.
  await db.transaction("rw", tablesToRestore.map((name) => db.table(name)), async () => {
    if (!merge) {
      for (const tableName of tablesToRestore) {
        await db.table(tableName).clear();
      }
    }

    for (const tableName of tablesToRestore) {
      const records = backup.data[tableName];
      if (records.length) {
        await db.table(tableName).bulkPut(records);
      }
      results[tableName] = records.length;
    }
  });

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