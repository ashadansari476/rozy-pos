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

    // Accumulate integer paise to avoid binary floating-point drift.
    totalPaise += Math.round(item.qty * item.cost * 100);
  }

  return totalPaise / 100;
}
