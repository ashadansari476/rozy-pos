import { useState } from "react";
import Modal from "../ui/Modal";
import { recordWastage } from "../../lib/inventory";
import { useApp } from "../../stores/appStore";
import { AlertTriangle } from "lucide-react";

const REASONS = [
  "Expired",
  "Stale / Not fresh",
  "Damaged in storage",
  "Customer return",
  "Other",
];

export default function WastageModal({ open, onClose, product, onSaved }) {
  const user = useApp((s) => s.user);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("Expired");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!product) return null;

  const qtyNum = parseFloat(qty) || 0;
  const costValue = (product.cost || 0) * qtyNum;

  const handleSave = async () => {
    if (qtyNum <= 0) return;
    setSaving(true);
    try {
      await recordWastage({
        productId: product.id,
        qty: qtyNum,
        reason,
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
    <Modal open={open} onClose={onClose} title={`Record Wastage — ${product.name}`} size="sm">
      <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-5 flex items-start gap-3">
        <AlertTriangle size={20} className="text-warning flex-shrink-0 mt-0.5" />
        <div className="text-xs text-ink">
          Wastage deducts stock and logs the cost as a loss. Use this for spoiled, expired,
          or damaged items.
        </div>
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
        <div className="text-xs text-ink-muted mt-1 text-center">
          Available: {product.stock} {product.unit}
        </div>
      </div>

      <div className="mb-4">
        <label className="label">Reason</label>
        <select
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="label">Note (optional)</label>
        <input
          className="input"
          placeholder="Extra details"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {qtyNum > 0 && (
        <div className="bg-danger/10 rounded-xl p-4 mb-4 text-center">
          <div className="text-xs text-ink-muted uppercase">Cost Loss</div>
          <div className="font-mono text-2xl font-bold text-danger mt-1">
            - ₹{costValue.toFixed(2)}
          </div>
          {!product.cost && (
            <div className="text-xs text-ink-muted mt-1">
              Add cost price to see loss values
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onClose} className="btn-outline flex-1">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || qtyNum <= 0}
          className="btn-primary flex-1 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Record Wastage"}
        </button>
      </div>
    </Modal>
  );
}