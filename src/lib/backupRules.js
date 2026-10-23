// Pure backup envelope validation, separate from IndexedDB for deterministic tests.
export function validateBackupForRestore(backup, availableTables, { merge = false } = {}) {
  if (!backup || typeof backup !== "object" || !backup.data ||
      typeof backup.data !== "object" || Array.isArray(backup.data)) {
    throw new Error("Invalid backup file: expected a Rozy POS backup with a data object");
  }
  if (backup.appName && backup.appName !== "Rozy POS") {
    throw new Error("This backup does not appear to belong to Rozy POS");
  }
  if (backup.version !== undefined &&
      (!Number.isInteger(backup.version) || backup.version < 1 || backup.version > 1)) {
    throw new Error(`Unsupported backup version: ${backup.version}`);
  }

  for (const tableName of availableTables) {
    const records = backup.data[tableName];
    if (records === undefined) {
      if (!merge) {
        throw new Error(`Cannot replace local data: backup is missing the "${tableName}" table. Use a complete backup.`);
      }
      continue;
    }
    if (!Array.isArray(records) ||
        records.some((record) => !record || typeof record !== "object" || Array.isArray(record))) {
      throw new Error(`Invalid backup: "${tableName}" must contain an array of records`);
    }
    if (backup.counts && backup.counts[tableName] !== undefined &&
        backup.counts[tableName] !== records.length) {
      throw new Error(`Invalid backup: record count for "${tableName}" does not match`);
    }
  }

  return availableTables.filter((name) => Array.isArray(backup.data[name]));
}
