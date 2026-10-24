/**
 * Pure report selectors shared by Compare Shops and regular reports.
 * A selected bakery is matched by the canonical shopId, not the legacy
 * counter label (which can be "Both", capitalized, or missing).
 */
export function filterReportSales(allSales, { from, to, counter, shopId } = {}) {
  if (shopId != null && shopId !== "rozy" && shopId !== "warish") {
    throw new Error("Unknown bakery for sales report");
  }
  return allSales.filter((sale) =>
    (from == null || sale.ts >= from) &&
    (to == null || sale.ts <= to) &&
    (shopId == null || sale.shopId === shopId) &&
    (!counter || counter === "Both" || sale.counter === counter)
  );
}

/** Only include line items whose sale survived the bakery/date filter. */
export function filterReportItems(allItems, sales) {
  const saleIds = new Set(sales.map((sale) => sale.id));
  return allItems.filter((item) => saleIds.has(item.saleId));
}

/** Only the selected bakery's sold items contribute to the Top Item card. */
export function topItemsForReport(items) {
  const totals = new Map();
  for (const item of items) {
    const name = item.name || "";
    if (!totals.has(name)) totals.set(name, {
      name, qty: 0, unit: item.unit, revenue: 0,
    });
    const result = totals.get(name);
    result.qty += item.qty;
    result.revenue += item.lineTotal || item.qty * item.price;
  }
  return [...totals.values()].sort((a, b) => b.revenue - a.revenue);
}
