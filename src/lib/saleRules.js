// Pure checkout rules: suitable for unit tests and offline use.
export function validateSaleItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Cannot save an empty bill");
  for (const item of items) {
    if (!item || item.id === null || item.id === undefined) throw new Error("Sale item requires a product ID");
    if (!Number.isFinite(item.qty) || item.qty <= 0) throw new Error("Sale quantity must be positive and finite");
    if (!Number.isFinite(item.price) || item.price < 0) throw new Error("Sale price must be non-negative and finite");
    if (item.cost !== undefined && (!Number.isFinite(item.cost) || item.cost < 0)) throw new Error("Sale cost must be non-negative and finite");
    const amount = Math.round(item.qty * item.price * 100);
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Sale line amount exceeds safe currency limits");
  }
}
export function remainingStockAfterSale(stock, qty) {
  if (!Number.isFinite(stock) || stock < 0) throw new Error("Invalid existing stock");
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Invalid sale quantity");
  // Never silently clamp negative stock: it hides an oversold quantity.
  const remaining = stock - qty;
  if (!Number.isFinite(remaining) || remaining < -1e-9) throw new Error("Insufficient stock for sale");
  return Math.max(0, remaining);
}
