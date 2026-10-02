import { useCart } from "../../stores/cartStore";
import { useTranslation } from "react-i18next";
import { X, Trash2, Minus, Plus, Percent, IndianRupee } from "lucide-react";
import { useState } from "react";

export default function CartPanel({ onCheckout, onHold }) {
  const { t } = useTranslation();
  const {
    items, discount, discountType,
    remove, clear, updateQty, setDiscount,
    subtotal, discountAmount, total, itemCount,
  } = useCart();

  const [showDiscInput, setShowDiscInput] = useState(false);
  const [discVal, setDiscVal] = useState(discount || "");

  const sub = subtotal();
  const disc = discountAmount();
  const tot = total();

  const applyDiscount = () => {
    const v = parseFloat(discVal) || 0;
    setDiscount(v, discountType);
    setShowDiscInput(false);
  };

  return (
    <div
      className="h-full flex flex-col rounded-xl2 overflow-hidden"
      style={{
        background: "#FFF8E7",
        border: "2px solid #B8935A",
        boxShadow: "0 4px 16px rgba(107, 68, 35, 0.15)",
      }}
    >
      {/* Header */}
      <div
        className="p-4 flex-shrink-0"
        style={{
          borderBottom: "1px solid #B8935A",
          background: "linear-gradient(180deg, #FFF8E7 0%, #FDF3DD 100%)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-serif text-lg font-semibold text-primary">
              🛒 {t("cart") || "Current Bill"}
            </div>
            <div className="text-xs text-ink-muted mt-0.5">
              {items.length} items · {itemCount()} units
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={clear}
              className="p-2 text-ink-muted hover:text-danger hover:bg-danger/10 rounded-lg transition"
              title="Clear cart"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Items — scrollable */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {items.length === 0 ? (
          <div className="text-center py-12 text-ink-muted text-sm">
            <div className="text-4xl mb-2">🍽️</div>
            {t("cart_empty")}
            <div className="text-xs mt-1">Tap products to add</div>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((it) => (
              <div
                key={it.cartKey}
                className="bg-bg rounded-xl p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-ink truncate">
                      {it.name}
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5 font-mono">
                      ₹{it.price} / {it.unit}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(it.cartKey)}
                    className="p-1 text-ink-faint hover:text-danger rounded transition flex-shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        updateQty(
                          it.cartKey,
                          Math.max(0, it.qty - (it.unit === "kg" ? 0.1 : 1))
                        )
                      }
                      className="w-8 h-8 rounded-lg bg-surface border border-border hover:border-primary
                                 flex items-center justify-center text-ink transition"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      step={it.unit === "kg" ? "0.01" : "1"}
                      value={it.qty}
                      onChange={(e) =>
                        updateQty(it.cartKey, parseFloat(e.target.value) || 0)
                      }
                      className="w-16 text-center font-mono font-semibold text-sm
                                 border border-border rounded-lg py-1.5
                                 focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={() =>
                        updateQty(it.cartKey, it.qty + (it.unit === "kg" ? 0.1 : 1))
                      }
                      className="w-8 h-8 rounded-lg bg-surface border border-border hover:border-primary
                                 flex items-center justify-center text-ink transition"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="font-mono font-bold text-primary text-base">
                    ₹{(it.qty * it.price).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary + Actions — fixed at bottom */}
      {items.length > 0 && (
        <div
          className="flex-shrink-0 p-4 space-y-3"
          style={{ borderTop: "1px solid #B8935A" }}
        >
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">{t("subtotal")}</span>
            <span className="font-mono font-semibold">₹{sub.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted flex items-center gap-1">
              {t("discount")}
              <button
                onClick={() =>
                  setDiscountType(discountType === "amount" ? "percent" : "amount")
                }
                className="p-0.5 hover:bg-primary-light rounded"
                title="Toggle ₹ / %"
              >
                {discountType === "amount" ? (
                  <IndianRupee size={12} />
                ) : (
                  <Percent size={12} />
                )}
              </button>
            </span>
            {showDiscInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={discVal}
                  onChange={(e) => setDiscVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyDiscount()}
                  className="w-20 text-right font-mono text-sm border border-border rounded-lg px-2 py-1
                             focus:outline-none focus:border-primary"
                  autoFocus
                />
                <button
                  onClick={applyDiscount}
                  className="text-primary font-semibold text-xs hover:underline"
                >
                  OK
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDiscInput(true)}
                className="font-mono font-semibold text-accent hover:underline"
              >
                {disc > 0 ? `- ₹${disc.toFixed(2)}` : "+ Add"}
              </button>
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="font-serif text-lg font-semibold text-primary">
              {t("total")}
            </span>
            <span className="font-mono text-2xl font-bold text-primary">
              ₹{tot.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div
        className="flex-shrink-0 p-4 space-y-2"
        style={{ borderTop: "1px solid #B8935A" }}
      >
        <button
          onClick={onHold}
          disabled={items.length === 0}
          className="btn-outline w-full disabled:opacity-40"
        >
          ⏸ {t("hold_bill")}
        </button>
        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="btn-primary w-full py-4 text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("checkout")} ₹{tot.toFixed(2)}
        </button>
      </div>
    </div>
  );
}