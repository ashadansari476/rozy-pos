import { useState } from "react";
import Modal from "../ui/Modal";
import { adjustStock } from "../../lib/inventory";
import { useApp } from "../../stores/appStore";
import { Plus, Minus, Check } from "lucide-react";

const REASONS = [
  { key: "restock", label: "Restock (received)", sign: "+" },
  { key: "correction", label: "Correction (count mismatch)", sign: "+/-" },
  { key: "damage", label: "Damaged", sign: "-" },
  { key: "wastage", label: "Wastage", sign: "-" },
];

export default function StockAdjustModal({ open, onClose, product, onSaved }) {
  const user = useApp((s) => s.user);
  const [mode, setMode] = useState("add"); // add | remove
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("restock");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!product) return null;

  const qtyNum = parseFloat(qty) || 0;
  const current = product.stock || 0;
  const newStock =
    mode === "add" ? current + qtyNum : Math.max(0, current - qtyNum);

  const handleSave = async () => {
    if (qtyNum <= 0) return;
    setSaving(true);
    try {
      await adjustStock({
        productId: product.id,
        qty: mode === "add" ? qtyNum : -qtyNum,
        reason: mode === "add" ? "restock" : reason,
        note,
        user: user.username,
      });
      onSaved?.();
      onClose();
    } catch (e) {
      alert("Failed: " + e.message);
    }
    setSaving(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={`Adjust Stock — ${product.name}`} size="sm">
      <div className="bg-bg/45 rounded-xl p-4 mb-5 text-center">
        <div className="text-xs text-ink-muted uppercase tracking-wider">
          Current Stock
        </div>
        <div className="font-mono text-3xl font-bold text-primary mt-1">
          {current} <span className="text-base text-ink-muted">{product.unit}</span>
        </div>
      </div>

      {/* Add / Remove toggle */}
      <div className="flex gap-2 mb-4 bg-bg/45 rounded-xl p-1">
        <button
          onClick={() => setMode("add")}
          className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
            mode === "add" ? "bg-success text-white" : "text-ink-muted"
          }`}
        >
          <Plus size={16} /> Add
        </button>
        <button
          onClick={() => setMode("remove")}
          className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
            mode === "remove" ? "bg-danger text-white" : "text-ink-muted"
          }`}
        >
          <Minus size={16} /> Remove
        </button>
      </div>

      <div className="mb-4">
        <label className="label">Quantity ({product.unit})</label>
        <input
          type="number"
          step="0.01"
          className="input font-mono text-2xl text-center"
          placeholder="0"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          autoFocus
        />
      </div>

      {mode === "remove" && (
        <div className="mb-4">
          <label className="label">Reason</label>
          <select
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REASONS.filter((r) => r.sign === "-" || r.sign === "+/-").map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-4">
        <label className="label">Note (optional)</label>
        <input
          className="input"
          placeholder="e.g. received from Sharma ji"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* Preview */}
      <div className={`rounded-xl p-4 mb-4 text-center ${
        mode === "add" ? "bg-success/10" : "bg-danger/10"
      }`}>
        <div className="text-xs text-ink-muted uppercase">New Stock</div>
        <div className={`font-mono text-2xl font-bold mt-1 ${
          mode === "add" ? "text-success" : "text-danger"
        }`}>
          {newStock} {product.unit}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onClose} className="btn-outline flex-1">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || qtyNum <= 0}
          className="btn-primary flex-1 disabled:opacity-40"
        >
          <Check size={16} /> {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </Modal>
  );
}