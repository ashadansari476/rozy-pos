import test from "node:test";
import assert from "node:assert/strict";
import { validatePurchaseItems } from "./src/lib/inventoryRules.js";

const item = (qty, cost) => ({ productId: 1, qty, cost });

test("purchase total uses integer minor-unit rounding", () => {
  assert.equal(validatePurchaseItems([item(1, 0.1), item(1, 0.2)]), 0.3);
  assert.equal(validatePurchaseItems([item(3, 0.335)]), 1.01);
});

test("purchase requires at least one valid item", () => {
  assert.throws(() => validatePurchaseItems([]), /at least one/);
  assert.throws(() => validatePurchaseItems([{}]), /reference a product/);
  assert.throws(() => validatePurchaseItems([item(0, 5)]), /positive/);
  assert.throws(() => validatePurchaseItems([item(1, -1)]), /non-negative/);
});

test("purchase rejects overflowed line amounts", () => {
  assert.throws(() => validatePurchaseItems([item(1e15, 100)]), /safe currency limits/);
});

test("purchase rejects overflowed aggregate totals", () => {
  const almostLimit = Math.floor(Number.MAX_SAFE_INTEGER / 100) - 100;
  assert.throws(() => validatePurchaseItems([item(1, almostLimit), item(1, almostLimit)]), /safe currency limits/);
});

test("purchase rejects non-finite computed line amounts", () => {
  assert.throws(() => validatePurchaseItems([item(1e308, 1e308)]), /safe currency limits/);
});

test("purchase rejects non-finite quantities and costs", () => {
  assert.throws(() => validatePurchaseItems([item(Infinity, 2)]), /positive/);
  assert.throws(() => validatePurchaseItems([item(1, NaN)]), /non-negative/);
});
