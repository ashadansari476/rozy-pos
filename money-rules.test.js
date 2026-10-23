// Run with:  npm test      (uses Node's built-in test runner, nothing to install)
import test from "node:test";
import assert from "node:assert/strict";
import { r2, toCents, isRefund, netCash } from "../src/lib/money.js";
import { evaluatePayment } from "../src/lib/paymentRules.js";
import { computeRefund, refundableLeft, itemKey } from "../src/lib/refundRules.js";
import { computeExpectedCash } from "../src/lib/cashRules.js";

// ---------- money ----------
test("r2 removes floating point drift", () => {
  assert.equal(r2(0.1 + 0.2), 0.3);
  assert.equal(r2(1.005), 1.01);
  assert.equal(r2(-1.005), -1.01);
  assert.equal(r2(99.99999999), 100);
  assert.equal(toCents(19.99), 1999);
});

test("netCash: change is not counted as sales cash", () => {
  assert.equal(netCash({ payment: { cash: 100, change: 15 } }), 85);
  assert.equal(netCash({ payment: { upi: 85 } }), 0);
  assert.equal(netCash({}), 0);
});

test("netCash: a cash refund reduces drawer cash", () => {
  const refund = { payment: { refundOf: 7, cash: -40 } };
  assert.equal(isRefund(refund), true);
  assert.equal(netCash(refund), -40);
});

// ---------- payments ----------
test("cash: overpay gives change and reconciles", () => {
  const r = evaluatePayment({ mode: "Cash", cash: 100, total: 85 });
  assert.equal(r.ok, true);
  assert.equal(r.payment.change, 15);
  assert.equal(r.payment.cash - r.payment.change, 85);
});

test("cash: short payment is not complete", () => {
  const r = evaluatePayment({ mode: "Cash", cash: 50, total: 85 });
  assert.equal(r.ok, false);
  assert.equal(r.remaining, 35);
});

test("UPI and Card must match the bill exactly", () => {
  assert.equal(evaluatePayment({ mode: "UPI", upi: 85, total: 85 }).ok, true);
  const over = evaluatePayment({ mode: "UPI", upi: 100, total: 85 });
  assert.equal(over.ok, false);
  assert.match(over.error, /match the bill/);
  assert.equal(evaluatePayment({ mode: "Card", card: 90, total: 85 }).ok, false);
});

test("split: change comes out of cash and totals reconcile", () => {
  const r = evaluatePayment({ mode: "Split", cash: 50, upi: 50, card: 0, total: 85 });
  assert.equal(r.ok, true);
  assert.equal(r.payment.change, 15);
  const net = r.payment.cash - r.payment.change + r.payment.upi + r.payment.card;
  assert.equal(r2(net), 85);
});

test("split: digital payments above the bill are rejected", () => {
  const r = evaluatePayment({ mode: "Split", cash: 0, upi: 60, card: 40, total: 85 });
  assert.equal(r.ok, false);
});

test("payment ignores fields of other modes and negative numbers", () => {
  const r = evaluatePayment({ mode: "Cash", cash: 85, upi: 999, card: 999, total: 85 });
  assert.equal(r.payment.upi, 0);
  assert.equal(r.ok, true);
  assert.equal(evaluatePayment({ mode: "Cash", cash: -5, total: 85 }).ok, false);
});

test("float amounts do not break exact matching", () => {
  assert.equal(evaluatePayment({ mode: "UPI", upi: 0.1 + 0.2, total: 0.3 }).ok, true);
});

// ---------- refunds ----------
const sale = { subtotal: 200, discount: 0, total: 200 };
const items = [
  { productId: 1, name: "Barfi", unit: "piece", qty: 4, price: 25 },
  { productId: 2, name: "Samosa", unit: "piece", qty: 10, price: 10 },
];

test("partial refund pays back the item price", () => {
  const r = computeRefund({ sale, saleItems: items, selections: { [itemKey(items[0])]: 2 } });
  assert.equal(r.ok, true);
  assert.equal(r.total, 50);
});

test("cannot refund more than was sold", () => {
  const r = computeRefund({ sale, saleItems: items, selections: { [itemKey(items[0])]: 5 } });
  assert.equal(r.ok, false);
});

test("cannot refund the same item twice beyond what is left", () => {
  const prior = [{ total: -75, items: [{ productId: 1, qty: -3 }] }];
  const ok = computeRefund({ sale, saleItems: items, priorRefunds: prior, selections: { [itemKey(items[0])]: 1 } });
  assert.equal(ok.ok, true);
  const bad = computeRefund({ sale, saleItems: items, priorRefunds: prior, selections: { [itemKey(items[0])]: 2 } });
  assert.equal(bad.ok, false);
});

test("refund shares the bill discount proportionally", () => {
  const discounted = { subtotal: 200, discount: 20, total: 180 };
  const r = computeRefund({ sale: discounted, saleItems: items, selections: { [itemKey(items[1])]: 10 } });
  assert.equal(r.total, 90); // 100 of goods * 0.9
});

test("final refund returns exactly what is left (no paise left behind)", () => {
  const odd = { subtotal: 100, discount: 0.01, total: 99.99 };
  const one = [{ productId: 1, name: "X", unit: "piece", qty: 3, price: 33.33333 }];
  const first = computeRefund({ sale: odd, saleItems: one, selections: { [itemKey(one[0])]: 1 } });
  const second = computeRefund({
    sale: odd, saleItems: one,
    priorRefunds: [{ total: -first.total, items: [{ productId: 1, qty: -1 }] }],
    selections: { [itemKey(one[0])]: 2 },
  });
  assert.equal(r2(first.total + second.total), 99.99);
});

test("kg items can be refunded by weight", () => {
  const kg = [{ productId: 9, name: "Laddoo", unit: "kg", qty: 1.5, price: 800 }];
  const r = computeRefund({ sale: { subtotal: 1200, total: 1200 }, saleItems: kg, selections: { [itemKey(kg[0])]: 0.5 } });
  assert.equal(r.total, 400);
});

test("empty selection is rejected; refundableLeft reports what remains", () => {
  assert.equal(computeRefund({ sale, saleItems: items, selections: {} }).ok, false);
  const left = refundableLeft({ saleItems: items, priorRefunds: [{ total: -25, items: [{ productId: 1, qty: -1 }] }] });
  assert.equal(left[itemKey(items[0])], 3);
});

// ---------- day-end cash ----------
test("expected cash: opening + net cash - refunds + order cash - drawer expenses", () => {
  const sales = [
    { payment: { cash: 100, change: 15 } },          // +85
    { payment: { upi: 200 } },                        // 0
    { payment: { refundOf: 1, cash: -40 } },          // -40
  ];
  const r = computeExpectedCash({ openingCash: 500, sales, orderCashIn: 300, drawerExpenses: 120 });
  assert.equal(r.expectedCash, 725); // 500 + 85 - 40 + 300 - 120
});
