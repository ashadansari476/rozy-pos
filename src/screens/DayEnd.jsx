import { useEffect, useState } from "react";
import { useShop } from "../stores/shopStore";
import { useApp } from "../stores/appStore";
import {
  getTodayCash, startDay, endDay,
  buildDayEndSummary, formatSummaryText, todayKeyForUI,
} from "../lib/owner";
import {
  Calculator, Lock, Unlock, Check, AlertTriangle,
  Share2, X, Save, TrendingUp,
} from "lucide-react";

export default function DayEnd() {
  const { currentShopId, currentShop } = useShop();
  const user = useApp((s) => s.user);

  const [drawer, setDrawer] = useState(null);
  const [summary, setSummary] = useState(null);
  const [openingInput, setOpeningInput] = useState("");
  const [closingInput, setClosingInput] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // "start" | "end"

  const load = async () => {
    setLoading(true);
    const [d, s] = await Promise.all([
      getTodayCash(currentShopId),
      buildDayEndSummary({ shopId: currentShopId, date: todayKeyForUI() }),
    ]);
    setDrawer(d);
    setSummary(s);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [currentShopId]);

  const handleStartDay = async () => {
    const amount = parseFloat(openingInput) || 0;
    await startDay({ shopId: currentShopId, openingCash: amount, user: user.username });
    setOpeningInput("");
    setModal(null);
    await load();
  };

  const handleEndDay = async () => {
    const amount = parseFloat(closingInput) || 0;
    await endDay({
      shopId: currentShopId,
      closingCash: amount,
      user: user.username,
      notes,
    });
    setClosingInput("");
    setNotes("");
    setModal(null);
    await load();
  };

  const handleShareWhatsApp = async () => {
    const text = await formatSummaryText({
      shopId: currentShopId,
      date: todayKeyForUI(),
    });
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  if (loading || !summary) {
    return (
      <div className="h-full flex items-center justify-center text-ink-muted">
        Loading...
      </div>
    );
  }

  const dayClosed = drawer?.closingCash !== null && drawer?.closingCash !== undefined;
  const dayOpened = !!drawer;

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[200px]">
          <h1 className="font-serif text-2xl text-primary font-semibold flex items-center gap-2">
            <Calculator size={24} /> Day End
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            {currentShop?.name} · {new Date().toLocaleDateString("en-IN", {
              weekday: "long", day: "numeric", month: "long",
            })}
          </p>
        </div>
        <button onClick={handleShareWhatsApp} className="btn-outline text-sm">
          <Share2 size={16} /> Share Summary
        </button>
      </div>

      {/* Cash Drawer Section */}
      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-ink mb-4 flex items-center gap-2">
          <Calculator size={16} className="text-primary" /> Cash Drawer
        </h2>

        {!dayOpened ? (
          <div className="text-center py-6">
            <div className="text-ink-muted text-sm mb-4">
              Start the day by entering opening cash
            </div>
            <button onClick={() => setModal("start")} className="btn-primary">
              <Unlock size={16} /> Start Day
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg/45 rounded-xl p-3">
                <div className="text-xs text-ink-muted uppercase">Opening Cash</div>
                <div className="font-mono text-lg font-bold text-ink mt-1">
                  ₹{(drawer.openingCash || 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-ink-muted mt-1">
                  by {drawer.openedBy} at {new Date(drawer.openedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div className="bg-success/10 rounded-xl p-3">
                <div className="text-xs text-ink-muted uppercase">Cash Sales</div>
                <div className="font-mono text-lg font-bold text-success mt-1">
                  ₹{summary.payment.cash.toFixed(2)}
                </div>
                <div className="text-[10px] text-ink-muted mt-1">
                  {summary.billCount} bills today
                </div>
              </div>
            </div>

            {dayClosed ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-bg/45 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-ink-muted uppercase">Expected</div>
                    <div className="font-mono text-base font-bold mt-1">
                      ₹{drawer.expectedCash?.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-bg/45 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-ink-muted uppercase">Actual</div>
                    <div className="font-mono text-base font-bold mt-1">
                      ₹{drawer.closingCash?.toFixed(2)}
                    </div>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${
                    Math.abs(drawer.difference || 0) < 0.01
                      ? "bg-success/10"
                      : "bg-danger/10"
                  }`}>
                    <div className="text-[10px] text-ink-muted uppercase">Difference</div>
                    <div className={`font-mono text-base font-bold mt-1 ${
                      Math.abs(drawer.difference || 0) < 0.01
                        ? "text-success"
                        : "text-danger"
                    }`}>
                      ₹{(drawer.difference || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="bg-success/10 rounded-xl p-3 text-center text-sm">
                  <Check size={16} className="inline text-success mr-1" />
                  <span className="font-semibold text-success">Day closed</span>
                  <div className="text-xs text-ink-muted mt-1">
                    by {drawer.closedBy} at {new Date(drawer.closedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                {drawer.notes && (
                  <div className="bg-bg/45 rounded-xl p-3 text-xs">
                    <b>Notes:</b> {drawer.notes}
                  </div>
                )}
              </>
            ) : (
              <button onClick={() => setModal("end")} className="btn-primary w-full">
                <Lock size={16} /> Close Day & Reconcile Cash
              </button>
            )}
          </div>
        )}
      </div>

      {/* Today's Summary */}
      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-ink mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" /> Today's Summary
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Total Sales" value={`₹${summary.totalSales.toFixed(0)}`} color="primary" />
          <Stat label="Bills" value={summary.billCount} color="accent" />
          <Stat label="Expenses" value={`₹${summary.totalExpenses.toFixed(0)}`} color="danger" />
          <Stat label="Wastage" value={`₹${summary.totalWastage.toFixed(0)}`} color="warning" />
        </div>

        <div className="space-y-2 mt-4 pt-4 border-t border-border">
          <Row label="💵 Cash" value={`₹${summary.payment.cash.toFixed(2)}`} />
          <Row label="📱 UPI" value={`₹${summary.payment.upi.toFixed(2)}`} />
          <Row label="💳 Card" value={`₹${summary.payment.card.toFixed(2)}`} />
        </div>
      </div>

      {/* Top Items */}
      {summary.topItems.length > 0 && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-ink mb-3">🏆 Top Items Today</h2>
          <div className="space-y-2">
            {summary.topItems.map((it, i) => (
              <div key={it.name} className="flex justify-between text-sm bg-bg/45 rounded-lg p-2">
                <span className="truncate">
                  <b>{i + 1}.</b> {it.name}
                </span>
                <span className="font-mono ml-2 flex-shrink-0">
                  {it.qty.toFixed(2)} {it.unit} · ₹{it.revenue.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {(summary.pendingOrders > 0 || summary.lowStockCount > 0) && (
        <div className="card p-5">
          <h2 className="font-semibold text-warning mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> Alerts
          </h2>
          <div className="space-y-2">
            {summary.pendingOrders > 0 && (
              <div className="text-sm">
                ⏰ <b>{summary.pendingOrders}</b> pending order{summary.pendingOrders > 1 ? "s" : ""}
              </div>
            )}
            {summary.lowStockCount > 0 && (
              <div className="text-sm">
                ⚠️ <b>{summary.lowStockCount}</b> item{summary.lowStockCount > 1 ? "s" : ""} low on stock
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start Day Modal */}
      {modal === "start" && (
        <ModalLike onClose={() => setModal(null)} title="Start Day">
          <div className="space-y-4">
            <div>
              <label className="label">Opening Cash (₹)</label>
              <input
                type="number"
                step="0.01"
                className="input font-mono text-2xl text-center"
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
                placeholder="0"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleStartDay()}
              />
              <div className="text-xs text-ink-muted mt-2 text-center">
                Amount in cash drawer at start of day
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <button onClick={() => setModal(null)} className="btn-outline flex-1">
              Cancel
            </button>
            <button onClick={handleStartDay} className="btn-primary flex-1">
              <Unlock size={16} /> Start Day
            </button>
          </div>
        </ModalLike>
      )}

      {/* End Day Modal */}
      {modal === "end" && (
        <ModalLike onClose={() => setModal(null)} title="Close Day">
          <div className="space-y-4">
            <div className="bg-accent-light rounded-xl p-4 text-center">
              <div className="text-xs text-ink-muted uppercase">Expected in Drawer</div>
              <div className="font-mono text-2xl font-bold text-accent mt-1">
                ₹{((drawer?.openingCash || 0) + summary.payment.cash).toFixed(2)}
              </div>
              <div className="text-xs text-ink-muted mt-1">
                Opening ₹{(drawer?.openingCash || 0).toFixed(0)} + Cash sales ₹{summary.payment.cash.toFixed(0)}
              </div>
            </div>

            <div>
              <label className="label">Actual Cash Counted (₹)</label>
              <input
                type="number"
                step="0.01"
                className="input font-mono text-2xl text-center"
                value={closingInput}
                onChange={(e) => setClosingInput(e.target.value)}
                placeholder="0"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleEndDay()}
              />
            </div>

            {closingInput && (
              <div className={`rounded-xl p-3 text-center ${
                Math.abs(
                  parseFloat(closingInput) - ((drawer?.openingCash || 0) + summary.payment.cash)
                ) < 0.01
                  ? "bg-success/10"
                  : "bg-danger/10"
              }`}>
                <div className="text-xs text-ink-muted uppercase">Difference</div>
                <div className="font-mono text-xl font-bold mt-1">
                  ₹{(
                    parseFloat(closingInput) -
                    ((drawer?.openingCash || 0) + summary.payment.cash)
                  ).toFixed(2)}
                </div>
              </div>
            )}

            <div>
              <label className="label">Notes (optional)</label>
              <input
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. gave ₹50 change to Sharma ji"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <button onClick={() => setModal(null)} className="btn-outline flex-1">
              Cancel
            </button>
            <button onClick={handleEndDay} className="btn-primary flex-1">
              <Lock size={16} /> Close Day
            </button>
          </div>
        </ModalLike>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  const colorMap = {
    primary: "text-primary",
    accent: "text-accent",
    danger: "text-danger",
    warning: "text-warning",
  };
  return (
    <div className="bg-bg/45 rounded-xl p-3">
      <div className="text-[10px] text-ink-muted uppercase tracking-wider">{label}</div>
      <div className={`font-mono text-lg font-bold mt-1 ${colorMap[color]}`}>{value}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span>{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

// Simple inline modal
function ModalLike({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface/70 rounded-xl2 shadow-warmH max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl text-primary font-semibold">{title}</h2>
          <button onClick={onClose} className="p-2 text-ink-muted hover:bg-primary-light rounded-lg">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}