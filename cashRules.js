// ============================================================
// Expected cash in the drawer at day-end. Pure function.
//   opening float
//   + cash kept from bills (cash handed over minus change)
//   - cash paid out for refunds              (refund bills carry negative cash)
//   + cash received on orders (advances / balance payments)
//   - expenses paid from the drawer
// ============================================================

import { netCash, r2 } from "./money.js";

export function computeExpectedCash({ openingCash = 0, sales = [], orderCashIn = 0, drawerExpenses = 0 }) {
  const cashFromBills = sales.reduce((sum, s) => sum + netCash(s), 0);
  const expected = r2(
    (Number(openingCash) || 0) + cashFromBills + (Number(orderCashIn) || 0) - (Number(drawerExpenses) || 0)
  );
  return { expectedCash: expected, cashFromBills: r2(cashFromBills) };
}
