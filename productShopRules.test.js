import test from "node:test";
import assert from "node:assert/strict";
import { productBelongsToShop, filterProductsForShop, withShopStock } from "./src/lib/productShopRules.js";
const products = [
  { id: 1, name: "Legacy bread", price: 40 },
  { id: 2, name: "Rozy cake", price: 200, shopId: "rozy" },
  { id: 3, name: "Warish cake", price: 250, shopId: "warish" },
];
test("legacy products remain visible only in Rozy", () => {
  assert.deepEqual(filterProductsForShop(products, "rozy").map((p) => p.id), [1,2]);
  assert.deepEqual(filterProductsForShop(products, "warish").map((p) => p.id), [3]);
});
test("separate shops can use separate prices for same product name", () => {
  assert.equal(filterProductsForShop(products, "rozy").find((p) => p.name === "Rozy cake").price, 200);
  assert.equal(filterProductsForShop(products, "warish").find((p) => p.name === "Warish cake").price, 250);
});
test("missing product cannot be treated as owned", () => {
  assert.equal(productBelongsToShop(null, "rozy"), false);
  assert.equal(productBelongsToShop(products[2], "rozy"), false);
});

test("Warish Inventory hides Rozy products even if local IndexedDB contains both shops", () => {
  const inventory = withShopStock(
    [
      { id: 67, name: "SYNC_TEST_ROZY_67", shopId: "rozy", unit: "piece", price: 10 },
      { id: 70, name: "Warish bread", shopId: "warish", unit: "piece", price: 20 },
    ],
    [
      { productId: 67, shopId: "rozy", stock: 5, lowStock: 5 },
      { productId: 70, shopId: "warish", stock: 8, lowStock: 2 },
    ],
    "warish"
  );
  assert.deepEqual(inventory.map((p) => p.name), ["Warish bread"]);
  assert.equal(inventory[0].stock, 8);
  assert.equal(inventory[0].lowStock, 2);
});

test("Rozy Inventory shows its own 5 units and never borrows Warish's stock", () => {
  const inventory = withShopStock(
    [{ id: 67, shopId: "rozy", name: "SYNC_TEST_ROZY_67", unit: "piece" }],
    [
      { productId: 67, shopId: "rozy", stock: 5 },
      { productId: 67, shopId: "warish", stock: 100 },
    ],
    "rozy"
  );
  assert.equal(inventory[0].stock, 5);
  assert.equal(inventory[0].unit, "piece");
});

test("missing stock record defaults to zero and old untagged records belong to Rozy", () => {
  const records = [{ id: 1, name: "Legacy pastry" }];
  assert.equal(withShopStock(records, [], "warish").length, 0);
  assert.equal(withShopStock(records, [], "rozy")[0].stock, 0);
});
