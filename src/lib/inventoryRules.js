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


/**
 * HTML <select> always returns string IDs; IndexedDB supplier IDs are numbers.
 * Normalize once so a saved supplier is looked up and synced correctly.
 */
export function normalizePurchaseSupplierId(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Select a valid supplier for this bakery");
  }
  return id;
}
