import test from "node:test";
import assert from "node:assert/strict";
import { CLOUD_COLUMNS, serializeCloudRecord, deserializeCloudRecord } from "./src/lib/syncPayloadRules.js";

const orderMap = {
  shopId: "shop_id", orderNo: "order_no", customerId: "customer_id",
  customerName: "customer_name", customerPhone: "customer_phone",
  totalAmount: "total_amount", advanceAmount: "advance_amount",
  balanceAmount: "balance_amount", orderType: "order_type",
  deliveryDate: "delivery_date", createdAtTs: "created_at_ts",
  createdAt: "created_at", updatedAt: "updated_at",
};

test("all cloud schemas include the primary key", () => {
  assert.equal(Object.keys(CLOUD_COLUMNS).length, 20);
  for (const cols of Object.values(CLOUD_COLUMNS)) assert.ok(cols.includes("id"));
});

test("order business information survives round-trip inside JSONB data", () => {
  const order = {
    id: 121, shopId: "warish", orderNo: "ORD-121", status: "pending",
    customerName: "A", customerPhone: "123", customerId: 33,
    items: [{ productId: 4, qty: 2, price: 15 }], totalAmount: 30,
    advanceAmount: 10, balanceAmount: 20, orderType: "pickup",
    notes: "Birthday", address: "Street", deliveryDate: 2000000,
    createdAt: 1760000000000, updatedAt: 1760000000000,
  };
  const cloud = serializeCloudRecord(order, "orders", orderMap);
  assert.deepEqual(Object.keys(cloud).filter(k => !CLOUD_COLUMNS.orders.includes(k)), []);
  assert.equal(cloud.shop_id, "warish");
  assert.equal(cloud.data.totalAmount, 30);
  assert.equal(cloud.data.customerPhone, "123");
  assert.equal(cloud.data.items.length, 1);
  assert.equal(cloud.total_amount, undefined);
  const roundTrip = deserializeCloudRecord(cloud, "orders", orderMap);
  assert.equal(roundTrip.balanceAmount, 20);
  assert.equal(roundTrip.orderType, "pickup");
  assert.equal(roundTrip.shopId, "warish");
  assert.equal(roundTrip.createdAt, 1760000000000);
});

test("sale items omit unsupported cost column rather than failing PostgREST", () => {
  const item = { id: 2, saleId: 1, productId: 3, cost: 9, qty: 2, price: 12 };
  const cloud = serializeCloudRecord(item, "saleItems", { saleId: "sale_id", productId: "product_id" });
  assert.equal(cloud.cost, undefined);
  assert.deepEqual(cloud, { id: 2, sale_id: 1, product_id: 3, qty: 2, price: 12 });
});

test("sales cannot send unrecognized local checkout fields", () => {
  const cloud = serializeCloudRecord(
    { id: 1, shopId: "rozy", ts: 22, total: 99, counter: "rozy", unexpected: true },
    "sales", { shopId: "shop_id" }, ["counter"]);
  assert.deepEqual(cloud, { id: 1, shop_id: "rozy", ts: 22, total: 99 });
});

test("order pulls preserve native status rather than overwritten JSONB status", () => {
  const local = deserializeCloudRecord(
    { id: 9, status: "delivered", shop_id: "rozy", data: { status: "pending", totalAmount: 50 } },
    "orders", orderMap);
  assert.equal(local.status, "delivered");
  assert.equal(local.totalAmount, 50);
});
