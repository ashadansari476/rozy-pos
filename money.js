// ============================================================
// Money helpers shared by billing, reports and day-end.
// Pure functions: no database, easy to test (see /tests).
// ============================================================

/** Round to 2 decimals without floating-point drift (0.1 + 0.2 -> 0.3). */
export function r2(n) {
  const x = Number(n) || 0;
  const sign = x < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(x) + Number.EPSILON) * 100)) / 100;
}

/** Integer paise, for exact comparisons. */
export function toCents(n) {
  return Math.round((Number(n) || 0) * 100);
}

/** A refund bill is stored as a sale with negative amounts and payment.refundOf = original sale id. */
export function isRefund(sale) {
  const ref = sale?.payment?.refundOf;
  return ref !== undefined && ref !== null;
}

// Cash that actually STAYED in the drawer for a bill.
// - normal bill: cash handed over minus change given back
// - refund bill: payment.cash is negative (cash paid out to the customer)
export function netCash(sale) {
  const p = sale?.payment || {};
  const cash = Number(p.cash) || 0;
  if (isRefund(sale)) return cash;
  return Math.max(0, cash - (Number(p.change) || 0));
}
