import test from "node:test";
import assert from "node:assert/strict";
import { productBelongsToShop, filterProductsForShop } from "./src/lib/productShopRules.js";
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
