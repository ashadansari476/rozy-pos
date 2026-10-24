import test from "node:test";
import assert from "node:assert/strict";
import { shouldApplyRemoteRecord } from "./src/lib/syncConflictRules.js";
test("newer remote update replaces older clean local record", () => {
  assert.equal(shouldApplyRemoteRecord({ updatedAt: 1000 }, { updatedAt: 2000 }), true);
});
test("older remote update never replaces newer local record", () => {
  assert.equal(shouldApplyRemoteRecord({ updatedAt: 2000 }, { updatedAt: 1000 }), false);
});
test("equal timestamps and missing remote timestamp do not overwrite", () => {
  assert.equal(shouldApplyRemoteRecord({ updatedAt: 2000 }, { updatedAt: 2000 }), false);
  assert.equal(shouldApplyRemoteRecord({ updatedAt: 2000 }, {}), false);
});
test("ISO timestamps and numeric timestamps compare correctly", () => {
  assert.equal(shouldApplyRemoteRecord({ updatedAt: "2026-10-23T00:00:00Z" }, { updatedAt: Date.parse("2026-10-24T00:00:00Z") }), true);
});
