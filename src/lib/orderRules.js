/** Validate a new order before opening a Dexie write transaction. */
export function validateNewOrder({ items, totalAmount, advanceAmount }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order needs at least one product");
  }
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error("Order total must be positive and finite");
  }
  const advance = advanceAmount ?? 0;
  if (!Number.isFinite(advance) || advance < 0 || advance > totalAmount) {
    throw new Error("Advance must be between zero and the order total");
  }
  let computedTotal = 0;
  for (const item of items) {
    if (item?.productId == null || item.productId === "") {
      throw new Error("Order item requires a product ID");
    }
    if (!Number.isFinite(item.qty) || item.qty <= 0 ||
        !Number.isFinite(item.price) || item.price < 0) {
      throw new Error("Order item quantity and price are invalid");
    }
    computedTotal += item.qty * item.price;
  }
  const cents = Math.round(computedTotal * 100);
  if (!Number.isSafeInteger(cents) ||
      Math.abs(cents - Math.round(totalAmount * 100)) > 1) {
    throw new Error("Order total does not match its items");
  }
  return advance;
}
