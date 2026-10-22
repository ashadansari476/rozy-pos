import { create } from "zustand";
import { useApp } from "./appStore";

const currentRole = () => useApp.getState().user?.role;

export const useCart = create((set, get) => ({
  items: [],
  discount: 0,
  discountType: "amount", // "amount" | "percent"

  add: (product, qty = 1, variant = null) => {
    const { items } = get();
    const key = variant ? `${product.id}-${variant.label}` : `${product.id}`;
    const existing = items.find((i) => i.cartKey === key);

    const price = variant ? variant.price : product.price;
    const name = variant ? `${product.name} (${variant.label})` : product.name;
    const available = product.stock ?? Infinity;

    // Stock check
    const newQty = existing ? existing.qty + qty : qty;
    if (newQty > available) {
      const role = currentRole();

      if (role !== "owner") {
        alert(`❌ Insufficient stock\n\nAvailable: ${available} ${product.unit}\nRequested: ${newQty} ${product.unit}`);
        return;
      }
      if (!confirm(
        `⚠️ Only ${available} ${product.unit} in stock.\n` +
        `Add ${qty} ${product.unit} anyway?`
      )) return;
    }

    if (existing) {
      set({
        items: items.map((i) =>
          i.cartKey === key ? { ...i, qty: newQty, availableStock: available } : i
        ),
      });
    } else {
      set({
        items: [
          ...items,
          {
            cartKey: key,
            id: product.id,
            name,
            baseName: product.name,
            unit: product.unit,
            price,
            qty,
            variant: variant ? variant.label : null,
            availableStock: available,
          },
        ],
      });
    }
  },

  updateQty: (cartKey, qty) => {
    if (qty <= 0) return get().remove(cartKey);
    const item = get().items.find((i) => i.cartKey === cartKey);
    if (!item) return;

    // Stock check
    const available = item.availableStock ?? Infinity;
    if (qty > available) {
      const role = currentRole();

      if (role !== "owner") {
        alert(`❌ Insufficient stock\n\nAvailable: ${available} ${item.unit}\nRequested: ${qty} ${item.unit}`);
        return;
      }
      if (!confirm(
        `⚠️ Only ${available} ${item.unit} in stock.\n` +
        `Set quantity to ${qty}? (Stock will go to 0)`
      )) return;
    }

    set({
      items: get().items.map((i) =>
        i.cartKey === cartKey ? { ...i, qty } : i
      ),
    });
  },

  remove: (cartKey) => {
    set({ items: get().items.filter((i) => i.cartKey !== cartKey) });
  },

  clear: () => set({ items: [], discount: 0, discountType: "amount" }),

  setDiscount: (discount, discountType = "amount") =>
    set({ discount, discountType }),

  // Computed
  subtotal: () => get().items.reduce((s, i) => s + i.qty * i.price, 0),

  discountAmount: () => {
    const { discount, discountType } = get();
    const sub = get().subtotal();
    const d = Math.max(0, Number(discount) || 0);
    if (discountType === "percent") return (sub * Math.min(d, 100)) / 100;
    return Math.min(d, sub);
  },

  total: () => Math.max(0, get().subtotal() - get().discountAmount()),

  itemCount: () => get().items.reduce((s, i) => s + i.qty, 0),
}));