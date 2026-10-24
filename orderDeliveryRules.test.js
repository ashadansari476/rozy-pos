import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDeliverySettlement, validateDeliveryStock,
} from "./src/lib/orderDeliveryRules.js";

const order = {
  status: "ready",
  totalAmount: 20,
  advanceAmount: 5,
  balanceAmount: 15,
  items: [{ productId: 67, qty: 2 }],
};
test("delivery collects 15 rupees after a 5-rupee advance", () => {
  assert.deepEqual(validateDeliverySettlement(order, 15, "Cash"), {
    balance: 15, change: 0, paidPreviously: 5,
  });
});
test("cash over-tender returns change instead of becoming extra revenue", () => {
  assert.deepEqual(validateDeliverySettlement(order, 20, "Cash"), {
    balance: 15, change: 5, paidPreviously: 5,
  });
  assert.throws(() => validateDeliverySettlement(order, 20, "UPI"), /Non-cash/);
});
test("cannot deliver before full payment or deliver the same order twice", () => {
  assert.throws(() => validateDeliverySettlement(order, 14, "Cash"), /balance/);
  assert.throws(() => validateDeliverySettlement({ ...order, status: "delivered" }, 15, "Cash"), /cannot/);
  assert.throws(() => validateDeliverySettlement({ ...order, status: "cancelled" }, 15, "Cash"), /cannot/);
  assert.throws(() => validateDeliverySettlement(order, NaN, "Cash"), /finite/);
  assert.throws(() => validateDeliverySettlement(order, 15, "Crypto"), /Choose/);
});
test("stock goes from 4 to 2 on successful order delivery", () => {
  const stock = new Map([[67, { shopId: "rozy", productId: 67, stock: 4 }]]);
  assert.equal(validateDeliveryStock(order.items, stock).get(67), 2);
});
test("missing or insufficient stock cancels delivery without clamping to zero", () => {
  assert.throws(() => validateDeliveryStock(order.items, new Map()), /Missing stock/);
  const tooLow = new Map([[67, { stock: 1 }]]);
  assert.throws(() => validateDeliveryStock(order.items, tooLow), /Insufficient stock/);
});
test("multiple lines for the same product cannot bypass stock validation", () => {
  const items = [{ productId: 67, qty: 2 }, { productId: 67, qty: 3 }];
  const stock = new Map([[67, { stock: 4 }]]);
  assert.throws(() => validateDeliveryStock(items, stock), /Insufficient stock/);
});
