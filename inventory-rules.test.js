import test from "node:test";
import assert from "node:assert/strict";
import { validatePurchaseItems } from "./src/lib/inventoryRules.js";

test("purchase total uses paise precision", () => {
  assert.equal(validatePurchaseItems([
    { productId: 1, qty: 3, cost: 0.1 },
    { productId: 2, qty: 2, cost: 1.25 },
  ]), 2.8);
});

test("empty purchase is rejected", () => {
  assert.throws(() => validatePurchaseItems([]), /at least one item/);
});

test("purchase without a product is rejected", () => {
  assert.throws(() => validatePurchaseItems([{ qty: 1, cost: 2 }]), /reference a product/);
});

test("zero and negative quantities are rejected", () => {
  assert.throws(() => validatePurchaseItems([{ productId: 1, qty: 0, cost: 2 }]), /quantities must be positive/);
  assert.throws(() => validatePurchaseItems([{ productId: 1, qty: -1, cost: 2 }]), /quantities must be positive/);
});

test("negative or non-finite costs are rejected", () => {
  assert.throws(() => validatePurchaseItems([{ productId: 1, qty: 1, cost: -0.01 }]), /costs must be valid/);
  assert.throws(() => validatePurchaseItems([{ productId: 1, qty: 1, cost: Number.NaN }]), /costs must be valid/);
});
