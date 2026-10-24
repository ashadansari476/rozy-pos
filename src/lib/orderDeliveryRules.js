import { remainingStockAfterSale } from "./saleRules";

/**
 * The delivery is a final settlement, not an opportunity to silently erase
 * an outstanding balance or charge more than the customer owes.
 */
export function validateDeliverySettlement(order, paymentAmount, paymentMode) {
  if (!order || order.status === "delivered" || order.status === "cancelled") {
    throw new Error("This order cannot be delivered");
  }
  if (!Array.isArray(order.items) || !order.items.length) {
    throw new Error("Order has no items to deliver");
  }
  const balance = order.balanceAmount ?? (order.totalAmount - (order.advanceAmount || 0));
  if (!Number.isFinite(balance) || balance < 0) {
    throw new Error("Order balance is invalid");
  }
  if (!Number.isFinite(paymentAmount) || paymentAmount < 0) {
    throw new Error("Delivery payment must be finite and non-negative");
  }
  if (!["Cash", "UPI", "Card"].includes(paymentMode)) {
    throw new Error("Choose Cash, UPI or Card for the delivery");
  }
  if (Math.round(paymentAmount * 100) < Math.round(balance * 100)) {
    throw new Error("Collect the outstanding balance before delivery");
  }
  if (paymentMode !== "Cash" &&
      Math.round(paymentAmount * 100) !== Math.round(balance * 100)) {
    throw new Error("Non-cash payments must equal the outstanding balance");
  }
  const change = Math.max(0, Math.round((paymentAmount - balance) * 100) / 100);
  return { balance, change, paidPreviously: order.advanceAmount || 0 };
}

/**
 * Validate every stock line against the selected shop *before* recording any
 * movement. Repeated products are aggregated to prevent overselling.
 */
export function validateDeliveryStock(items, stockByProduct) {
  const requested = new Map();
  for (const item of items) {
    if (item.productId == null || !Number.isFinite(item.qty) || item.qty <= 0) {
      throw new Error("Invalid delivery item");
    }
    requested.set(item.productId,
      (requested.get(item.productId) || 0) + item.qty);
  }
  const remaining = new Map();
  for (const [productId, qty] of requested) {
    const existing = stockByProduct.get(productId);
    if (!existing) throw new Error(`Missing stock for order product ${productId}`);
    remaining.set(productId, remainingStockAfterSale(existing.stock ?? 0, qty));
  }
  return remaining;
}
