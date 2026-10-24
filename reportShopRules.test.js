import test from "node:test";
import assert from "node:assert/strict";
import {
  filterReportSales, filterReportItems, topItemsForReport,
} from "./src/lib/reportShopRules.js";

const rozy = {
  id: 101, shopId: "rozy", counter: "rozy", ts: 1000, total: 10,
};
const sales = [rozy];
const items = [
  { id: 201, saleId: 101, productId: 67,
    name: "SYNC_TEST_ROZY_67", qty: 1, unit: "piece", price: 10, lineTotal: 10 },
];

test("regression: Rozy single 10-rupee sale does not appear in Warish today cards", () => {
  const rozySales = filterReportSales(sales, { from: 0, to: 2000, shopId: "rozy" });
  const warishSales = filterReportSales(sales, { from: 0, to: 2000, shopId: "warish" });
  assert.equal(rozySales.length, 1);
  assert.equal(rozySales.reduce((total, s) => total + s.total, 0), 10);
  assert.equal(warishSales.length, 0);
  assert.equal(warishSales.reduce((total, s) => total + s.total, 0), 0);
  const rozyTop = topItemsForReport(filterReportItems(items, rozySales));
  const warishTop = topItemsForReport(filterReportItems(items, warishSales));
  assert.equal(rozyTop[0].name, "SYNC_TEST_ROZY_67");
  assert.equal(rozyTop[0].revenue, 10);
  assert.deepEqual(warishTop, []);
});

test("two bakeries never share sale-item lists despite matching dates", () => {
  const mixedSales = [
    ...sales,
    { id: 102, shopId: "warish", counter: "warish", ts: 1000, total: 20 },
  ];
  const mixedItems = [
    ...items,
    { id: 202, saleId: 102, name: "Warish cake",
      qty: 1, unit: "piece", price: 20, lineTotal: 20 },
  ];
  const warishSales = filterReportSales(mixedSales, {
    from: 0, to: 2000, shopId: "warish",
  });
  assert.deepEqual(warishSales.map((s) => s.id), [102]);
  assert.deepEqual(
    topItemsForReport(filterReportItems(mixedItems, warishSales))
      .map((item) => item.name),
    ["Warish cake"],
  );
});

test("shopId governs even when counter labels are inconsistent", () => {
  const mislabeledSales = [
    { id: 1, shopId: "rozy", counter: "Warish", ts: 300, total: 10 },
    { id: 2, shopId: "warish", counter: "Rozy", ts: 300, total: 20 },
  ];
  assert.deepEqual(
    filterReportSales(mislabeledSales, { shopId: "warish" }).map((s) => s.id),
    [2],
  );
  assert.deepEqual(
    filterReportSales(mislabeledSales, { shopId: "rozy" }).map((s) => s.id),
    [1],
  );
});

test("legacy non-shop report can still intentionally include both bakeries", () => {
  assert.deepEqual(filterReportSales(sales, { from: 0, to: 2000 }), sales);
  assert.deepEqual(filterReportSales(sales, { from: 1001, to: 2000 }), []);
  assert.throws(() => filterReportSales(sales, { shopId: "unknown" }), /Unknown bakery/);
});
