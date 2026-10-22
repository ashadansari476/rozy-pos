import { useState } from "react";
import Modal from "../ui/Modal";
import { recordPurchase } from "../../lib/inventory";
import { useApp } from "../../stores/appStore";
import { useInventory } from "../../stores/inventoryStore";
import { Plus, Trash2, ShoppingCart } from "lucide-react";

export default function PurchaseModal({ open, onClose, products, suppliers, onSaved }) {
  const user = useApp((s) => s.user);
  const { reloadSuppliers } = useInventory();
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const addItem = () => {
    setItems([
      ...items,
      { productId: "", qty: "", cost: "", expiryDate: "", batchNo: "" },
    ]);
  };

  const updateItem = (idx, key, val) => {
    const updated = [...items];
    updated[idx][key] = val;
    setItems(updated);
  };

  const removeItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const getProduct = (pid) => products.find((p) => p.id === parseInt(pid));

  const handleSave = async () => {
    const validItems = items.filter((it) => it.productId && parseFloat(it.qty) > 0);
    if (!validItems.length) return alert("Add at least one item");

    setSaving(true);
    try {
      const payload = validItems.map((it) => {
        const p = getProduct(it.productId);
        return {
          productId: p.id,
          productName: p.name,
          qty: parseFloat(it.qty),
          unit: p.unit,
          cost: parseFloat(it.cost) || p.cost || 0,
          expiryDate: it.expiryDate ? new Date(it.expiryDate).getTime() : null,
          batchNo: it.batchNo,
        };
      });

      await recordPurchase({
        supplierId: supplierId || null,
        supplierName: supplierName || "Walk-in",
        items: payload,
        note,
        user: user.username,
      });

      onSaved?.();
      onClose();
      setItems([]);
      setNote("");
    } catch (e) {
      alert("Failed: " + e.message);
    }
    setSaving(false);
  };

  const grandTotal = items.reduce((s, it) => {
    const q = parseFloat(it.qty) || 0;
    const c = parseFloat(it.cost) || 0;
    return s + q * c;
  }, 0);

  return (
    <Modal open={open} onClose={onClose} title="Record Purchase (Stock In)" size="lg">
      {/* Supplier */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div>
          <label className="label">Supplier (saved)</label>
          <select
            className="input"
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              const s = suppliers.find((x) => x.id === parseInt(e.target.value));
              if (s) setSupplierName(s.name);
            }}
          >
            <option value="">— Walk-in / Unknown —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Or type supplier name</label>
          <input
            className="input"
            placeholder="Supplier name"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
          />
        </div>
      </div>

      {/* Items */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-sm text-ink">Items Received</div>
          <button onClick={addItem} className="btn-outline py-1.5 px-3 text-xs">
            <Plus size={14} /> Add Item
          </button>
        </div>

        {items.length === 0 ? (
          <div className="bg-bg/45 rounded-xl p-6 text-center text-ink-muted text-sm">
            <ShoppingCart size={24} className="mx-auto mb-2 text-ink-faint" />
            Click "Add Item" to start
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it, idx) => {
              const product = getProduct(it.productId);
              const lineTotal = (parseFloat(it.qty) || 0) * (parseFloat(it.cost) || 0);
              return (
                <div key={idx} className="bg-bg/45 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2 items-center">
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
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-ink-muted">Qty ({product?.unit || "?"})</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input font-mono mt-1"
                        placeholder="0"
                        value={it.qty}
                        onChange={(e) => updateItem(idx, "qty", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink-muted">Cost / unit (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input font-mono mt-1"
                        placeholder="0"
                        value={it.cost}
                        onChange={(e) => updateItem(idx, "cost", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink-muted">Line Total</label>
                      <div className="input font-mono mt-1 bg-accent-light text-accent font-bold">
                        ₹{lineTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-ink-muted">Expiry date (optional)</label>
                      <input
                        type="date"
                        className="input mt-1"
                        value={it.expiryDate}
                        onChange={(e) => updateItem(idx, "expiryDate", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink-muted">Batch no (optional)</label>
                      <input
                        className="input mt-1"
                        placeholder="e.g. B001"
                        value={it.batchNo}
                        onChange={(e) => updateItem(idx, "batchNo", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Note */}
      <div className="mb-4">
        <label className="label">Note (optional)</label>
        <input
          className="input"
          placeholder="e.g. Invoice #1234"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* Grand total */}
      {grandTotal > 0 && (
        <div className="bg-accent-light rounded-xl p-4 mb-4 text-center">
          <div className="text-xs text-ink-muted uppercase">Total Purchase Value</div>
          <div className="font-mono text-3xl font-bold text-accent mt-1">
            ₹{grandTotal.toFixed(2)}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onClose} className="btn-outline flex-1">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || items.length === 0}
          className="btn-primary flex-1 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Record Purchase"}
        </button>
      </div>
    </Modal>
  );
}