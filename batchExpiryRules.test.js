import test from "node:test";
import assert from "node:assert/strict";
import { isExpiredBatch, isExpiringBatch } from "./src/lib/batchExpiryRules.js";
const now = Date.UTC(2026, 9, 24, 12);
const row = (expiryDate, changes = {}) => ({ active: true, qty: 1, expiryDate, ...changes });

test("expired test batch appears only under expired, never expiring soon", () => {
  const yesterday = row(now - 24 * 60 * 60 * 1000);
  assert.equal(isExpiredBatch(yesterday, now), true);
  assert.equal(isExpiringBatch(yesterday, 3, now), false);
});
test("tomorrow expiry only appears in expiring soon", () => {
  const tomorrow = row(now + 24 * 60 * 60 * 1000);
  assert.equal(isExpiredBatch(tomorrow, now), false);
  assert.equal(isExpiringBatch(tomorrow, 3, now), true);
});
test("disposed batches and distant expiry appear in neither list", () => {
  const inactive = row(now - 1000, { active: false, qty: 0 });
  assert.equal(isExpiredBatch(inactive, now), false);
  assert.equal(isExpiringBatch(inactive, 3, now), false);
  assert.equal(isExpiringBatch(row(now + 5 * 86400000), 3, now), false);
});
test("invalid or missing expiry dates do not qualify", () => {
  assert.equal(isExpiredBatch(row(null), now), false);
  assert.equal(isExpiringBatch(row(null), 3, now), false);
  assert.equal(isExpiredBatch(row(NaN), now), false);
});
