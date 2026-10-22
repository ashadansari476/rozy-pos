// Cash that actually STAYED in the drawer for a sale.
// payment.cash stores what the customer handed over; payment.change is what was given back.
// Summing payment.cash alone overstated cash sales (a Rs 100 note for an Rs 85 bill counted
// as Rs 100), so "expected cash" at day-end was always too high.
export function netCash(sale) {
  const p = sale?.payment || {};
  return Math.max(0, (Number(p.cash) || 0) - (Number(p.change) || 0));
}
