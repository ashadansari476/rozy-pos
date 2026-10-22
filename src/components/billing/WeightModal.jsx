import { useState } from "react";
import Modal from "../ui/Modal";

const QUICK_WEIGHTS = [
  { label: "100g", value: 0.1 },
  { label: "250g", value: 0.25 },
  { label: "500g", value: 0.5 },
  { label: "1kg",  value: 1 },
  { label: "2kg",  value: 2 },
];

export default function WeightModal({ open, onClose, product, onConfirm }) {
  const [qty, setQty] = useState("");
  const [selected, setSelected] = useState(null);

  const handleQuick = (w) => {
    setQty(String(w.value));
    setSelected(w.value);
  };

  const handleConfirm = () => {
    const q = parseFloat(qty);
    if (!q || q <= 0) return;

    const available = product.stock || 0;
    const role = JSON.parse(localStorage.getItem("rozy-pos-app") || "{}")?.state?.user?.role;

    if (q > available) {
      if (role !== "owner") {
        alert(`❌ Insufficient stock\n\nAvailable: ${available} ${product.unit}\nRequested: ${q} ${product.unit}`);
        return;
      }
      if (!confirm(
        `⚠️ Only ${available} ${product.unit} in stock.\n` +
        `You're about to sell ${q} ${product.unit}.\n\n` +
        `Sell anyway? (Stock will go to 0)`
      )) return;
    }

    onConfirm(q);
    setQty("");
    setSelected(null);
  };

  if (!product) return null;

  const lineTotal = (parseFloat(qty) || 0) * product.price;

  return (
    <Modal open={open} onClose={onClose} title={`Add ${product.name}`} size="sm">
      <div className="text-center mb-5">
        <div className="text-sm text-ink-muted mb-1">Rate</div>
        <div className="font-mono text-2xl font-bold text-primary">
          ₹{product.price} <span className="text-base text-ink-muted">/ kg</span>
        </div>
      </div>

      {/* Quick buttons */}
      <div className="mb-5">
        <div className="label">Quick Select</div>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_WEIGHTS.map((w) => (
            <button
              key={w.label}
              onClick={() => handleQuick(w)}
              className={`py-3 rounded-xl font-semibold text-sm transition ${
                selected === w.value
                  ? "bg-primary text-white shadow-warm"
                  : "bg-bg/45 text-ink hover:bg-primary-light"
              }`}
            >
              {w.label}
            </button>
          ))}
          <button
            onClick={() => { setQty(""); setSelected(null); }}
            className="py-3 rounded-xl bg-bg/45 text-ink hover:bg-primary-light font-semibold text-sm"
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom input */}
      <div className="mb-5">
        <label className="label">Weight (kg)</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            step="0.01"
            className="input font-mono text-2xl text-center"
            placeholder="0.00"
            value={qty}
            onChange={(e) => { setQty(e.target.value); setSelected(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            autoFocus
          />
          <span className="text-lg font-semibold text-ink-muted">kg</span>
        </div>
      </div>

      {/* Line total */}
      {lineTotal > 0 && (
        <div className="bg-accent-light rounded-xl p-4 mb-4 text-center">
          <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">Line Total</div>
          <div className="font-mono text-2xl font-bold text-accent">
            ₹{lineTotal.toFixed(2)}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
        <button
          onClick={handleConfirm}
          disabled={!qty || parseFloat(qty) <= 0}
          className="btn-primary flex-1 disabled:opacity-40"
        >
          Add to Cart
        </button>
      </div>
    </Modal>
  );
}