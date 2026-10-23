// ============================================================
// Refund calculation. Pure functions, no database.
// A refund can only return what was sold and not yet refunded, and the money
// returned is the customer's NET price (bill discount shared out proportionally).
// ============================================================

import { r2, toCents } from "./money.js";

export const itemKey = (it) => `${it.productId}|${it.variant || ""}`;

const EPS = 1e-9;

/**
 * @param sale              { subtotal, discount, total }
 * @param saleItems         original sale lines  [{ productId, variant, name, unit, qty, price }]
 * @param priorRefunds      earlier refunds of this sale: { items: [{productId, variant, qty}], total }
 *                          (qty and total may be stored negative; absolute values are used)
 * @param selections        { [itemKey]: quantityToRefundNow }
 */
export function computeRefund({ sale, saleItems, priorRefunds = [], selections }) {
  const refundedQty = {};
  let refundedTotalC = 0;
  for (const r of priorRefunds) {
    refundedTotalC += Math.abs(toCents(r.total));
    for (const it of r.items || []) {
      const k = itemKey(it);
      refundedQty[k] = (refundedQty[k] || 0) + Math.abs(Number(it.qty) || 0);
    }
  }

  const saleTotalC = toCents(sale.total);
  const remainingValueC = Math.max(0, saleTotalC - refundedTotalC);
  const ratio = Number(sale.subtotal) > 0 ? Number(sale.total) / Number(sale.subtotal) : 1;

  const lines = [];
  let sumC = 0;
  let willExhaustAll = true;

  for (const it of saleItems) {
    const k = itemKey(it);
    const sold = Number(it.qty) || 0;
    const already = refundedQty[k] || 0;
    const left = sold - already;
    const want = Number(selections?.[k]) || 0;

    if (want < 0) return { ok: false, error: `Invalid quantity for ${it.name}`, lines: [], total: 0 };
    if (want - left > EPS) {
      return { ok: false, error: `${it.name}: only ${Math.max(0, left)} ${it.unit || ""} can still be refunded`, lines: [], total: 0 };
    }
    if (left - want > EPS) willExhaustAll = false;

    if (want > EPS) {
      const amountC = toCents(want * Number(it.price) * ratio);
      lines.push({
        key: k,
        productId: it.productId,
        variant: it.variant || null,
        name: it.name,
        unit: it.unit,
        qty: want,
        price: Number(it.price),
        amount: amountC / 100,
      });
      sumC += amountC;
    }
  }

  if (lines.length === 0) return { ok: false, error: "Select at least one item to refund", lines: [], total: 0 };

  let totalC = Math.min(sumC, remainingValueC);
  // last refund of a bill: return exactly what is left, so rounding never leaves a few paise behind
  if (willExhaustAll) totalC = remainingValueC;

  // keep the lines adding up to the total (put any paise difference on the last line)
  const diffC = totalC - sumC;
  if (diffC !== 0) {
    const last = lines[lines.length - 1];
    last.amount = (toCents(last.amount) + diffC) / 100;
  }

  return { ok: true, error: "", lines, total: totalC / 100, exhaustsBill: willExhaustAll };
}

/** How much of each line is still refundable (for the screen). */
export function refundableLeft({ saleItems, priorRefunds = [] }) {
  const refundedQty = {};
  for (const r of priorRefunds) {
    for (const it of r.items || []) {
      const k = itemKey(it);
      refundedQty[k] = (refundedQty[k] || 0) + Math.abs(Number(it.qty) || 0);
    }
  }
  const out = {};
  for (const it of saleItems) {
    const k = itemKey(it);
    out[k] = Math.max(0, (Number(it.qty) || 0) - (refundedQty[k] || 0));
  }
  return out;
}
