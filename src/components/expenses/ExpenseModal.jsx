import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { EXPENSE_CATEGORIES, addExpense, updateExpense } from "../../lib/owner";
import { useShop } from "../../stores/shopStore";
import { useApp } from "../../stores/appStore";
import { Save } from "lucide-react";

export default function ExpenseModal({ open, onClose, expense, onSaved }) {
  const user = useApp((s) => s.user);
  const { currentShopId } = useShop();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (expense) {
        setAmount(String(expense.amount || ""));
        setCategory(expense.category || "other");
        setNote(expense.note || "");
      } else {
        setAmount("");
        setCategory("other");
        setNote("");
      }
    }
  }, [open, expense]);

  const handleSave = async () => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return alert("Enter amount");

    setSaving(true);
    try {
      if (expense) {
        await updateExpense(expense.id, { amount: amt, category, note });
      } else {
        await addExpense({
          shopId: currentShopId,
          amount: amt,
          category,
          note,
          user: user.username,
        });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      alert("Failed: " + e.message);
    }
    setSaving(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? "Edit Expense" : "Add Expense"}
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="label">Amount (₹) *</label>
          <input
            type="number"
            step="0.01"
            className="input font-mono text-2xl text-center"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            autoFocus
          />
        </div>

        <div>
          <label className="label">Category</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`py-3 rounded-xl font-semibold text-xs flex flex-col items-center gap-1 transition ${
                  category === c.key
                    ? "bg-primary text-white shadow-warm"
                    : "bg-bg text-ink hover:bg-primary-light"
                }`}
              >
                <span className="text-lg">{c.icon}</span>
                <span className="text-[10px] text-center leading-tight">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Note (optional)</label>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. milk from Sharma dairy"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
        <button onClick={onClose} className="btn-outline">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !amount || parseFloat(amount) <= 0}
          className="btn-primary disabled:opacity-40"
        >
          <Save size={16} /> {saving ? "Saving..." : expense ? "Save Changes" : "Add Expense"}
        </button>
      </div>
    </Modal>
  );
}