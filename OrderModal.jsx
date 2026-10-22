import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { createOrder, updateOrder } from "../../lib/customers";
import { useApp } from "../../stores/appStore";
import { Plus, Trash2, Calendar, User, Phone, MapPin } from "lucide-react";
import CustomerPicker from "../customers/CustomerPicker";
import { localDateKey } from "../../lib/dates";

export default function OrderModal({ open, onClose, products, editingOrder, onSaved }) {
  const user = useApp((s) => s.user);
  const [customer, setCustomer] = useState(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [items, setItems] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [orderType, setOrderType] = useState("pickup");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [advance, setAdvance] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingOrder) {
      setCustomer({
        id: editingOrder.customerId,
        name: editingOrder.customerName,
        phone: editingOrder.customerPhone,
      });
      setItems(editingOrder.items || []);
      setDeliveryDate(
        editingOrder.deliveryDate
          ? new Date(editingOrder.deliveryDate).toISOString().slice(0, 10)
          : ""
      );
      setOrderType(editingOrder.orderType || "pickup");
      setAddress(editingOrder.address || "");
      setNotes(editingOrder.notes || "");
      setAdvance(String(editingOrder.advanceAmount || ""));
    } else {
      setCustomer(null);
      setItems([]);
      setDeliveryDate(localDateKey(new Date(Date.now() + 86400000)));
      setOrderType("pickup");
      setAddress("");
      setNotes("");
      setAdvance("");
    }
  }, [editingOrder, open]);

  const addItem = () => {
    setItems([...items, { productId: "", qty: "", price: "" }]);
  };

  const updateItem = (idx, key, val) => {
    const updated = [...items];
    updated[idx][key] = val;
    // auto-fill price when product selected
    if (key === "productId") {
      const p = products.find((x) => x.id === parseInt(val));
      if (p) updated[idx].price = String(p.price);
    }
    setItems(updated);
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const total = items.reduce((s, it) => {
    const q = parseFloat(it.qty) || 0;
    const p = parseFloat(it.price) || 0;
    return s + q * p;
  }, 0);

  const balance = total - (parseFloat(advance) || 0);

  const handleSave = async () => {
    if (!customer) return alert("Select a customer");
    const validItems = items.filter((it) => it.productId && parseFloat(it.qty) > 0);
    if (!validItems.length) return alert("Add at least one item");

    setSaving(true);
    try {
      const payload = {
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        items: validItems.map((it) => {
          const p = products.find((x) => x.id === parseInt(it.productId));
          return {
            productId: p.id,
            productName: p.name,
            qty: parseFloat(it.qty),
            unit: p.unit,
            price: parseFloat(it.price) || p.price,
            lineTotal: parseFloat(it.qty) * (parseFloat(it.price) || p.price),
          };
        }),
        totalAmount: total,
        advanceAmount: parseFloat(advance) || 0,
        deliveryDate,
        orderType,
        address,
        notes,
        user: user.username,
      };

      if (editingOrder) {
        // update path — simplified (no re-lock)
        await updateOrder(editingOrder.id, { ...payload, status: editingOrder.status });
      } else {
        await createOrder(payload);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      alert("Failed: " + e.message);
    }
    setSaving(false);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editingOrder ? "Edit Order" : "New Advance Order"}
        size="lg"
      >
        {/* Customer */}
        <div className="bg-bg/45 rounded-xl p-4 mb-4">
          <label className="label">Customer *</label>
          {customer ? (
            <div className="flex items-center gap-3 bg-surface/70 rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center">
                <User size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{customer.name}</div>
                {customer.phone && (
                  <div className="text-xs text-ink-muted flex items-center gap-1">
                    <Phone size={11} /> {customer.phone}
                  </div>
                )}
              </div>
              <button
                onClick={() => setCustomer(null)}
                className="text-xs text-ink-muted hover:text-danger"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomerPicker(true)}
              className="btn-outline w-full"
            >
              <User size={16} /> Select Customer
            </button>
          )}
        </div>

        {/* Items */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-sm">Items</div>
            <button onClick={addItem} className="btn-outline py-1.5 px-3 text-xs">
              <Plus size={14} /> Add Item
            </button>
          </div>

          {items.length === 0 ? (
            <div className="bg-bg/45 rounded-xl p-6 text-center text-ink-muted text-sm">
              No items yet — click "Add Item"
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => {
                const lineTotal = (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0);
                return (
                  <div key={idx} className="bg-bg/45 rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <select
                        className="input flex-1"
                        value={it.productId}
                        onChange={(e) => updateItem(idx, "productId", e.target.value)}
                      >
                        <option value="">— Select product —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeItem(idx)}
                        className="p-2 text-danger hover:bg-danger/10 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-ink-muted">Qty</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input mt-1 font-mono"
                          value={it.qty}
                          onChange={(e) => updateItem(idx, "qty", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-ink-muted">Price ₹</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input mt-1 font-mono"
                          value={it.price}
                          onChange={(e) => updateItem(idx, "price", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-ink-muted">Total</label>
                        <div className="input mt-1 font-mono bg-accent-light text-accent font-bold">
                          ₹{lineTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delivery info */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Delivery Date *</label>
            <input
              type="date"
              className="input"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Order Type</label>
            <select
              className="input"
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
            >
              <option value="pickup">Pickup</option>
              <option value="delivery">Home Delivery</option>
            </select>
          </div>
        </div>

        {orderType === "delivery" && (
          <div className="mb-4">
            <label className="label">Delivery Address</label>
            <input
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full address"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="label">Notes (optional)</label>
          <textarea
            className="input"
            rows="2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Happy Birthday Rahul — 12 candles"
          />
        </div>
        {/* Payment */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-bg/45 rounded-xl p-3 text-center">
            <div className="text-xs text-ink-muted uppercase">Total</div>
            <div className="font-mono text-xl font-bold text-primary mt-1">
              ₹{total.toFixed(2)}
            </div>
          </div>
          <div className="bg-success/10 rounded-xl p-3 text-center">
            <div className="text-xs text-ink-muted uppercase">Advance</div>
            <input
              type="number"
              step="0.01"
              className="w-full bg-transparent font-mono text-xl font-bold text-success text-center mt-1 focus:outline-none"
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="bg-warning/10 rounded-xl p-3 text-center">
            <div className="text-xs text-ink-muted uppercase">Balance</div>
            <div className="font-mono text-xl font-bold text-warning mt-1">
              ₹{balance.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <button onClick={onClose} className="btn-outline">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !customer || items.length === 0}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : editingOrder ? "Save Changes" : "Create Order"}
          </button>
        </div>
      </Modal>

      <CustomerPicker
        open={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        onSelect={(c) => setCustomer(c)}
      />
    </>
  );
}