// Pure purchase validation rules kept separate from IndexedDB for deterministic tests.
export function validatePurchaseItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("A purchase must contain at least one item");
  }

  let totalPaise = 0;
  for (const item of items) {
    if (!item || typeof item !== "object" || item.productId == null) {
      throw new Error("Every purchase item must reference a product");
    }
    if (!Number.isFinite(item.qty) || item.qty <= 0) {
      throw new Error("Purchase quantities must be positive numbers");
    }
    if (!Number.isFinite(item.cost) || item.cost < 0) {
      throw new Error("Purchase costs must be valid non-negative numbers");
    }
    // Reject multiplication overflow before rounding, and reject values that
    // cannot be represented accurately in the application's minor units.
    const rawPaise = item.qty * item.cost * 100;
    if (!Number.isFinite(rawPaise) || rawPaise < 0) {
      throw new Error("Purchase line amount exceeds safe currency limits");
    }
    const linePaise = Math.round(rawPaise);
    if (!Number.isSafeInteger(linePaise) || linePaise < 0) {
      throw new Error("Purchase line amount exceeds safe currency limits");
    }
    totalPaise += linePaise;
    if (!Number.isSafeInteger(totalPaise)) {
      throw new Error("Purchase total exceeds safe currency limits");
    }
  }

  return totalPaise / 100;
}
