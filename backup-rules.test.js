import test from "node:test";
import assert from "node:assert/strict";
import { validateBackupForRestore } from "./src/lib/backupRules.js";

const tables = ["products", "sales", "shopStock"];
const valid = {
  version: 1,
  appName: "Rozy POS",
  data: {
    products: [{ id: 1, name: "Test product" }],
    sales: [],
    shopStock: [{ id: 2, shopId: "rozy", productId: 1, stock: 5 }],
  },
  counts: { products: 1, sales: 0, shopStock: 1 },
};

test("valid complete backup returns tables to restore", () => {
  assert.deepEqual(validateBackupForRestore(valid, tables), tables);
});

test("backup with a missing required table is rejected for replacement restore", () => {
  const backup = { ...valid, data: { products: [], sales: [] }, counts: { products: 0, sales: 0 } };
  assert.throws(() => validateBackupForRestore(backup, tables), /missing the "shopStock" table/);
});

test("merge restore may omit tables but validates tables that are present", () => {
  const backup = { ...valid, data: { products: [] }, counts: { products: 0 } };
  assert.deepEqual(validateBackupForRestore(backup, tables, { merge: true }), ["products"]);
});

test("mismatched row counts are rejected", () => {
  const backup = { ...valid, counts: { ...valid.counts, products: 2 } };
  assert.throws(() => validateBackupForRestore(backup, tables), /record count for "products" does not match/);
});

test("unsupported versions and foreign app backups are rejected", () => {
  assert.throws(() => validateBackupForRestore({ ...valid, version: 2 }, tables), /Unsupported backup version/);
  assert.throws(() => validateBackupForRestore({ ...valid, appName: "Other POS" }, tables), /does not appear to belong/);
});

test("invalid table entries are rejected", () => {
  const backup = { ...valid, data: { ...valid.data, sales: [null] } };
  assert.throws(() => validateBackupForRestore(backup, tables), /must contain an array of records/);
});
