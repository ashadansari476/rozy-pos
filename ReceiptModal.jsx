import { useRef } from "react";
import Modal from "../ui/Modal";
import { Printer, Share2, Check } from "lucide-react";

export default function ReceiptModal({ open, onClose, sale, onPrint }) {
  const printRef = useRef();

  if (!sale) return null;

  const { billNo, ts, items, subtotal, discount, total, payment, counter, cashier } = sale;
  const date = new Date(ts);
  const dateStr = date.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });
  const timeStr = date.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit"
  });

  const shareWhatsApp = () => {
    const lines = [
      `*Rozy Sweet, Snacks & Bakery*`,
      `Bill: ${billNo}`,
      `${dateStr} ${timeStr}`,
      `———————————`,
      ...items.map((it) => `${it.name} × ${it.qty} = ₹${(it.qty * it.price).toFixed(2)}`),
      `———————————`,
      `Subtotal: ₹${subtotal.toFixed(2)}`,
      discount > 0 ? `Discount: -₹${discount.toFixed(2)}` : "",
      `*TOTAL: ₹${total.toFixed(2)}*`,
      `Paid (${payment.mode}): ₹${payment.paid.toFixed(2)}`,
      payment.change > 0 ? `Change: ₹${payment.change.toFixed(2)}` : "",
      ``,
      `Thank you! 🙏`,
    ].filter(Boolean).join("\n");
    const url = `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    onPrint(printRef.current.innerHTML);
  };

  return (
    <Modal open={open} onClose={onClose} title="Sale Complete ✅" size="md">
      <div className="bg-success/10 border border-success/30 rounded-xl p-4 mb-5 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-success text-white flex items-center justify-center">
          <Check size={24} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-success">Payment received</div>
          <div className="text-xs text-ink-muted">
            Bill {billNo} · {payment.mode}
          </div>
        </div>
      </div>

      <div className="bg-bg/45 rounded-xl p-4 mb-5 max-h-80 overflow-y-auto">
        <div ref={printRef} className="font-mono text-xs text-ink" style={{ width: "280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "14px" }}>
            Rozy Sweet, Snacks & Bakery
          </div>
          <div style={{ textAlign: "center", fontSize: "10px" }}>
            Sukhia Pokhri, Darjeeling
          </div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div>Bill : {billNo}</div>
          <div>Date : {dateStr} {timeStr}</div>
          <div>By   : {cashier}</div>
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          {items.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span>{it.name}</span>
              <span>₹{(it.qty * it.price).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Discount</span><span>-₹{discount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px", marginTop: "4px" }}>
            <span>TOTAL</span><span>₹{total.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Paid ({payment.mode})</span><span>₹{payment.paid.toFixed(2)}</span>
          </div>
          {payment.change > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Change</span><span>₹{payment.change.toFixed(2)}</span>
            </div>
          )}
          <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          <div style={{ textAlign: "center", fontSize: "11px" }}>
            Thank you! Visit again 🙏
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
        <button onClick={handlePrint} className="btn-outline justify-center py-3">
          <Printer size={16} /> Print
        </button>
        <button onClick={shareWhatsApp} className="btn-outline justify-center py-3">
          <Share2 size={16} /> WhatsApp
        </button>
        <button onClick={onClose} className="btn-primary justify-center py-3">
          Done
        </button>
      </div>
    </Modal>
  );
}