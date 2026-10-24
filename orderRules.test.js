import test from "node:test";
import assert from "node:assert/strict";
import { validateNewOrder } from "./src/lib/orderRules.js";

const order = {
  items: [{ productId: 67, qty: 2, price: 10 }],
  totalAmount: 20,
  advanceAmount: 5,
};

test("accept a two-piece order with a five-rupee advance", () => {
  assert.equal(validateNewOrder(order), 5);
});
test("accept no advance but reject a negative or oversized advance", () => {
  assert.equal(validateNewOrder({ ...order, advanceAmount: 0 }), 0);
  assert.throws(() => validateNewOrder({ ...order, advanceAmount: -1 }), /Advance/);
  assert.throws(() => validateNewOrder({ ...order, advanceAmount: 21 }), /Advance/);
});
test("reject a mismatched total or missing order item", () => {
  assert.throws(() => validateNewOrder({ ...order, totalAmount: 30 }), /total/);
  assert.throws(() => validateNewOrder({ ...order, items: [] }), /product/);
});
test("reject invalid quantities and prices before any payment can be saved", () => {
  assert.throws(() => validateNewOrder({
    ...order, items: [{ productId: 67, qty: 0, price: 10 }],
  }), /quantity/);
  assert.throws(() => validateNewOrder({
    ...order, items: [{ productId: 67, qty: 2, price: -1 }],
  }), /quantity/);
});
