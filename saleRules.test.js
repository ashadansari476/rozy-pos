import test from "node:test";
import assert from "node:assert/strict";
import { validateSaleItems, remainingStockAfterSale, assertSaleProductShop } from "./src/lib/saleRules.js";

const item = (qty, price, cost = 0) => ({ id: 123, qty, price, cost });
test("offline checkout accepts valid sale line items without network dependencies", () => {
  assert.doesNotThrow(() => validateSaleItems([item(2, 10), item(0.5, 25)]));
});
test("checkout rejects invalid or non-finite quantities and prices", () => {
  for (const value of [0, -1, NaN, Infinity]) assert.throws(() => validateSaleItems([item(value, 10)]));
  for (const value of [-1, NaN, Infinity]) assert.throws(() => validateSaleItems([item(1, value)]));
  assert.throws(() => validateSaleItems([item(1, 10, -1)]));
});
test("checkout rejects overflow and missing product identifiers", () => {
  assert.throws(() => validateSaleItems([item(1e308, 1e308)]), /safe currency limits/);
  assert.throws(() => validateSaleItems([{ qty: 1, price: 1 }]), /product ID/);
});
test("stock subtraction never silently loses oversold units", () => {
  assert.equal(remainingStockAfterSale(10, 3), 7);
  assert.equal(remainingStockAfterSale(0.3, 0.3), 0);
  assert.throws(() => remainingStockAfterSale(2, 3), /Insufficient stock/);
  assert.throws(() => remainingStockAfterSale(NaN, 1), /Invalid existing stock/);
});

test("offline checkout rejects products from another bakery", () => {
  assert.doesNotThrow(() => assertSaleProductShop({ id: 1 }, "rozy"));
  assert.doesNotThrow(() => assertSaleProductShop({ id: 2, shopId: "warish" }, "warish"));
  assert.throws(() => assertSaleProductShop({ id: 2, shopId: "warish" }, "rozy"), /another shop/);
  assert.throws(() => assertSaleProductShop({ id: 1 }, "warish"), /another shop/);
  assert.throws(() => assertSaleProductShop(undefined, "rozy"), /unknown product/);
});
