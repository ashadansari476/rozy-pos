import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { Banknote, Smartphone, CreditCard, SplitSquareHorizontal, Check } from "lucide-react";

const QUICK_CASH = [100, 200, 500, 1000, 2000];

export default function PaymentModal({ open, onClose, total, onConfirm }) {
  const [mode, setMode] = useState("Cash");
  const [cash, setCash] = useState("");
  const [upi, setUpi] = useState("");
  const [card, setCard] = useState("");

  // Auto-fill UPI/Card with total when mode changes
  useEffect(() => {
    if (mode === "UPI") setUpi(total.toFixed(2));
    if (mode === "Card") setCard(total.toFixed(2));
    if (mode === "Cash") setCash("");
    if (mode === "Split") { setCash(""); setUpi(""); setCard(""); }
  }, [mode, total]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setMode("Cash");
      setCash("");
      setUpi("");
      setCard("");
    }
  }, [open]);

  const cashNum = parseFloat(cash) || 0;
  const upiNum = parseFloat(upi) || 0;
  const cardNum = parseFloat(card) || 0;

  const paid =
    mode === "Cash" ? cashNum :
    mode === "UPI" ? upiNum :
    mode === "Card" ? cardNum :
    cashNum + upiNum + cardNum;

  const change = Math.max(0, paid - total);
  const remaining = Math.max(0, total - paid);
  const canConfirm = paid >= total && total > 0;

  const handleQuickCash = (amt) => setCash(String(amt));

  const confirm = () => {
    const payment = {
      mode,
      cash: mode === "Cash" ? cashNum : mode === "Split" ? cashNum : 0,
      upi: mode === "UPI" ? upiNum : mode === "Split" ? upiNum : 0,
      card: mode === "Card" ? cardNum : mode === "Split" ? cardNum : 0,
      paid,
      change: mode === "Split" ? 0 : change,
    };
    onConfirm(payment);
  };

  const modes = [
    { key: "Cash", icon: Banknote, label: "Cash" },
    { key: "UPI", icon: Smartphone, label: "UPI" },
    { key: "Card", icon: CreditCard, label: "Card" },
    { key: "Split", icon: SplitSquareHorizontal, label: "Split" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payment"
      size="md"
    >
      {/* Total */}
      <div className="bg-accent-light rounded-xl2 p-5 mb-5 text-center">
        <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">
          Amount Due
        </div>
        <div className="font-mono text-4xl font-bold text-accent">
          ₹{total.toFixed(2)}
        </div>
      </div>

      {/* Mode selection */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {modes.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`py-3 rounded-xl font-semibold text-xs flex flex-col items-center gap-1 transition ${
              mode === key
                ? "bg-primary text-white shadow-warm"
                : "bg-bg text-ink hover:bg-primary-light"
            }`}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </div>

      {/* Cash input */}
      {mode === "Cash" && (
        <>
          <div className="mb-4">
            <label className="label">Cash Received</label>
            <input
              type="number"
              className="input font-mono text-2xl text-center"
              placeholder="0"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && canConfirm && confirm()}
            />
          </div>
          <div className="mb-5">
            <div className="label">Quick Amounts</div>
            <div className="grid grid-cols-5 gap-2">
              {QUICK_CASH.map((amt) => (
                <button
                  key={amt}
                  onClick={() => handleQuickCash(amt)}
                  className="py-2.5 rounded-lg bg-bg hover:bg-primary-light font-mono font-semibold text-sm transition"
                >
                  ₹{amt}
                </button>
              ))}
            </div>
            <button
              onClick={() => handleQuickCash(total)}
              className="w-full mt-2 py-2.5 rounded-lg bg-bg hover:bg-primary-light font-semibold text-sm transition"
            >
              Exact ₹{total.toFixed(2)}
            </button>
          </div>
        </>
      )}

      {mode === "UPI" && (
        <div className="mb-5">
          <label className="label">UPI Amount Received</label>
          <input
            type="number"
            className="input font-mono text-2xl text-center"
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
          />
          <p className="text-xs text-ink-muted mt-2 text-center">
            Confirm UPI payment received on your phone, then complete sale
          </p>
        </div>
      )}

      {mode === "Card" && (
        <div className="mb-5">
          <label className="label">Card Amount</label>
          <input
            type="number"
            className="input font-mono text-2xl text-center"
            value={card}
            onChange={(e) => setCard(e.target.value)}
          />
          <p className="text-xs text-ink-muted mt-2 text-center">
            Swipe / tap card and confirm on POS machine
          </p>
        </div>
      )}

      {mode === "Split" && (
        <div className="space-y-3 mb-5">
          <div>
            <label className="label">Cash</label>
            <input
              type="number"
              className="input font-mono text-lg"
              placeholder="0"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
            />
          </div>
          <div>
            <label className="label">UPI</label>
            <input
              type="number"
              className="input font-mono text-lg"
              placeholder="0"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Card</label>
            <input
              type="number"
              className="input font-mono text-lg"
              placeholder="0"
              value={card}
              onChange={(e) => setCard(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Change / Remaining */}
      {mode !== "Split" && paid > 0 && (
        <div className={`rounded-xl p-4 text-center mb-4 ${
          change > 0 ? "bg-success/10" : "bg-warning/10"
        }`}>
          <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">
            {change > 0 ? "Change to Return" : "Remaining"}
          </div>
          <div className={`font-mono text-3xl font-bold ${
            change > 0 ? "text-success" : "text-warning"
          }`}>
            ₹{(change > 0 ? change : remaining).toFixed(2)}
          </div>
        </div>
      )}

      {mode === "Split" && (
        <div className="bg-bg rounded-xl p-4 mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-ink-muted">Entered</span>
            <span className="font-mono font-semibold">₹{paid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Remaining</span>
            <span className={`font-mono font-semibold ${remaining > 0 ? "text-warning" : "text-success"}`}>
              ₹{remaining.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-border">
        <button onClick={onClose} className="btn-outline flex-1">
          Cancel
        </button>
        <button
          onClick={confirm}
          disabled={!canConfirm}
          className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check size={18} /> Complete Sale
        </button>
      </div>
    </Modal>
  );
}