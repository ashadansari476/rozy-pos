import test from "node:test";
import assert from "node:assert/strict";
import { netCash } from "./src/lib/money.js";

// Baseline tests for the existing main branch. The previous file imported
// non-existent paymentRules/refundRules/cashRules modules and could not run.
// Restore the larger payment/refund suite only alongside its real implementation.
test("netCash excludes change given to the customer", () => {
  assert.equal(netCash({ payment: { cash: 100, change: 15 } }), 85);
});
test("netCash handles non-cash sales and missing payment details", () => {
  assert.equal(netCash({ payment: { upi: 85 } }), 0);
  assert.equal(netCash({}), 0);
});
test("netCash never reports negative sales cash under current implementation", () => {
  assert.equal(netCash({ payment: { cash: -40, refundOf: 7 } }), 0);
});
