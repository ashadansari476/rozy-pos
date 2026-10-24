import test from "node:test";
import assert from "node:assert/strict";
import { getPermissions, canChangePrices, canIssueRefunds, canDelete, canSwitchShops } from "./src/lib/permissions.js";

test("only owner can change prices, refund and delete", () => {
  for (const role of ["cashier", "manager", undefined, ""]) {
    const user = { role };
    assert.equal(canChangePrices(user), false);
    assert.equal(canIssueRefunds(user), false);
    assert.equal(canDelete(user), false);
  }
  const owner = { role: "owner" };
  assert.equal(canChangePrices(owner), true);
  assert.equal(canIssueRefunds(owner), true);
  assert.equal(canDelete(owner), true);
});

test("cashiers cannot switch between bakery shops", () => {
  assert.equal(canSwitchShops({ role: "cashier" }), false);
  assert.equal(canSwitchShops({ role: "owner" }), true);
});

test("unknown roles receive restricted permissions", () => {
  assert.deepEqual(getPermissions("unknown"), getPermissions("cashier"));
  assert.equal(canChangePrices(null), false);
  assert.equal(canIssueRefunds(null), false);
});
