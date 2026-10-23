import { useEffect, useMemo, useState } from "react";
import { Receipt, Search, Undo2 } from "lucide-react";
import { db } from "../lib/db";
import { useShop } from "../stores/shopStore";
import { useApp } from "../stores/appStore";
import { localDateKey } from "../lib/dates";
import { isRefund, r2 } from "../lib/money";
import { computeRefund, refundableLeft, itemKey } from "../lib/refundRules";
import { saveRefund, getRefundsForSale } from "../lib/billing";
import { verifyOwnerPin, lockSecondsLeft, recordFailedLogin, clearFailedLogins } from "../lib/auth";
import Modal from "../components/ui/Modal";
import { showToast } from "../components/ui/Toast";

const REASONS = [
  { label: "Billing mistake", restock: true },
  { label: "Customer return", restock: false },
  { label: "Quality issue", restock: false },
  { label: "Other", restock: false },
];

const fmt = (n) => `₹${Math.abs(Number(n) || 0).toFixed(2)}`;
const timeOf = (ts) => new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

// ---------------------------------------------------------------
// Refund window for one bill
// ---------------------------------------------------------------
function RefundModal({ sale, onClose, onDone }) {
  const user = useApp((s) => s.user);
  const isOwner = user?.role === "owner";
  const [items, setItems] = useState([]);
  const [prior, setPrior] = useState([]);
  const [qty, setQty] = useState({});
  const [method, setMethod] = useState("Cash");
  const [reasonIdx, setReasonIdx] = useState(0);
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sale) return;
    (async () => {
      setItems(await db.saleItems.where("saleId").equals(sale.id).toArray());
      setPrior(await getRefundsForSale(sale.id));
      setQty({});
      setError("");
      setPin("");
      setNote("");
      setReasonIdx(0);
      setRestock(true);
      setMethod("Cash");
    })();
  }, [sale]);

  const left = useMemo(() => refundableLeft({ saleItems: items, priorRefunds: prior }), [items, prior]);

  const calc = useMemo(() => {
    if (!sale) return null;
    const selections = {};
    for (const it of items) selections[itemKey(it)] = parseFloat(qty[itemKey(it)]) || 0;
    return computeRefund({ sale, saleItems: items, priorRefunds: prior, selections });
  }, [sale, items, prior, qty]);

  if (!sale) return null;

  const setAll = () => {
    const next = {};
    for (const it of items) next[itemKey(it)] = left[itemKey(it)] || 0;
    setQty(next);
  };

  const submit = async () => {
    setError("");
    if (!calc?.ok) return setError(calc?.error || "Select what to refund");
    const reason = REASONS[reasonIdx].label + (note.trim() ? `: ${note.trim()}` : "");
    setBusy(true);
    try {
      let approvedBy = user.username;
      if (!isOwner) {
        const wait = lockSecondsLeft();
        if (wait > 0) throw new Error(`Too many wrong attempts. Try again in ${wait}s`);
        if (!(await verifyOwnerPin(pin))) {
          recordFailedLogin();
          throw new Error("Wrong owner PIN");
        }
        clearFailedLogins();
        approvedBy = "Owner (PIN)";
      }
      const res = await saveRefund({
        saleId: sale.id,
        selections: Object.fromEntries(items.map((it) => [itemKey(it), parseFloat(qty[itemKey(it)]) || 0])),
        method,
        reason,
        restock,
        user: user.username,
        approvedBy,
      });
      showToast(`Refund ${res.billNo} saved: ${fmt(res.total)} to return by ${method}`, "success", 6000);
      onDone();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const allGone = items.length > 0 && items.every((it) => (left[itemKey(it)] || 0) <= 1e-9);

  return (
    <Modal open={!!sale} onClose={onClose} title={`Refund · ${sale.billNo}`} size="md">
      {allGone ? (
        <p className="text-ink-muted text-sm">Everything on this bill has already been refunded.</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-ink-muted">How many to refund?</span>
            <button className="text-sm text-primary font-semibold" onClick={setAll}>Refund everything left</button>
          </div>
          <div className="space-y-2 mb-4">
            {items.map((it) => {
              const k = itemKey(it);
              return (
                <div key={k} className="flex items-center gap-3 bg-bg/45 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{it.name}</div>
                    <div className="text-xs text-ink-muted">
                      sold {it.qty} {it.unit} at {fmt(it.price)} · can refund {left[k] ?? 0}
                    </div>
                  </div>
                  <input
                    aria-label={`Quantity of ${it.name} to refund`}
                    className="input !w-24 text-center"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    disabled={(left[k] || 0) <= 1e-9}
                    value={qty[k] ?? ""}
                    onChange={(e) => setQty((q) => ({ ...q, [k]: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label" htmlFor="rf-reason">Reason</label>
              <select
                id="rf-reason"
                className="input"
                value={reasonIdx}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setReasonIdx(i);
                  setRestock(REASONS[i].restock);
                }}
              >
                {REASONS.map((r, i) => <option key={r.label} value={i}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="rf-method">Money returned by</label>
              <select id="rf-method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
              </select>
            </div>
          </div>

          <label className="label" htmlFor="rf-note">Note (optional)</label>
          <input id="rf-note" className="input mb-3" value={note} onChange={(e) => setNote(e.target.value)} />

          <label className="flex items-center gap-2 text-sm mb-4">
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
            Put the items back in stock (only if they can be sold again)
          </label>

          {!isOwner && (
            <div className="mb-4">
              <label className="label" htmlFor="rf-pin">Owner PIN (approval needed)</label>
              <input
                id="rf-pin"
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          )}

          <div className="rounded-xl bg-accent-light p-4 text-center mb-3">
            <div className="text-xs uppercase tracking-wider text-ink-muted">Return to customer</div>
            <div className="font-mono text-3xl font-bold text-primary">{fmt(calc?.ok ? calc.total : 0)}</div>
          </div>

          {error && <div className="text-danger text-sm mb-3" role="alert">{error}</div>}

          <div className="flex gap-3 pt-3 border-t border-border">
            <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
            <button
              onClick={submit}
              disabled={busy || !calc?.ok || (!isOwner && pin.length < 4)}
              className="btn-primary flex-1 disabled:opacity-40"
            >
              <Undo2 size={18} /> Confirm refund
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------
// Bills list
// ---------------------------------------------------------------
export default function Bills() {
  const { currentShopId } = useShop();
  const [date, setDate] = useState(localDateKey());
  const [search, setSearch] = useState("");
  const [sales, setSales] = useState([]);
  const [refundedBy, setRefundedBy] = useState({}); // original sale id -> amount already refunded
  const [selected, setSelected] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [refunding, setRefunding] = useState(null);

  const load = async () => {
    const from = new Date(`${date}T00:00:00`).getTime();
    const to = new Date(`${date}T23:59:59.999`).getTime();
    const all = await db.sales.where("shopId").equals(currentShopId).toArray();
    setSales(all.filter((s) => s.ts >= from && s.ts <= to).sort((a, b) => b.ts - a.ts));
    const refunded = {};
    for (const s of all) {
      if (isRefund(s)) {
        const id = s.payment.refundOf;
        refunded[id] = r2((refunded[id] || 0) + Math.abs(s.total || 0));
      }
    }
    setRefundedBy(refunded);
  };

  useEffect(() => { load(); }, [currentShopId, date]);

  const openBill = async (s) => {
    setSelected(s);
    setSelectedItems(await db.saleItems.where("saleId").equals(s.id).toArray());
  };

  const shown = sales.filter((s) => !search.trim() || (s.billNo || "").toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="text-primary" size={22} />
          <h1 className="font-serif text-2xl font-semibold text-primary">Bills</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <input
            aria-label="Date"
            type="date"
            className="input"
            value={date}
            max={localDateKey()}
            onChange={(e) => setDate(e.target.value || localDateKey())}
          />
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              aria-label="Search by bill number"
              className="input !pl-9"
              placeholder="Search bill number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="card p-8 text-center text-ink-muted">No bills found for this day.</div>
        ) : (
          <div className="space-y-2">
            {shown.map((s) => {
              const refund = isRefund(s);
              const refundedAmt = refundedBy[s.id] || 0;
              return (
                <button
                  key={s.id}
                  onClick={() => openBill(s)}
                  className="card w-full text-left p-4 flex items-center gap-3 hover:shadow-warmH transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-semibold">{s.billNo}</div>
                    <div className="text-xs text-ink-muted">
                      {timeOf(s.ts)} · {s.cashier || "—"} · {refund ? `Refund via ${s.payment.method}` : s.payment?.mode}
                    </div>
                    {!refund && refundedAmt > 0 && (
                      <div className="text-xs text-danger mt-0.5">
                        {refundedAmt >= (s.total || 0) - 0.005 ? "Fully refunded" : `Part refunded ${fmt(refundedAmt)}`}
                      </div>
                    )}
                  </div>
                  <div className={`font-mono text-lg font-bold ${refund ? "text-danger" : "text-primary"}`}>
                    {refund ? "−" : ""}{fmt(s.total)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Bill ${selected.billNo}` : ""} size="md">
        {selected && (
          <>
            <div className="text-xs text-ink-muted mb-3">
              {new Date(selected.ts).toLocaleString("en-IN")} · {selected.cashier || "—"}
              {isRefund(selected) && ` · refund of ${selected.payment.originalBillNo}`}
            </div>
            <div className="space-y-1 mb-3">
              {selectedItems.map((it) => (
                <div key={it.id} className="flex justify-between text-sm">
                  <span>{it.name} × {Math.abs(it.qty)} {it.unit}</span>
                  <span className="font-mono">{it.qty < 0 ? "−" : ""}{fmt(it.lineTotal)}</span>
                </div>
              ))}
            </div>
            {selected.discount > 0 && (
              <div className="flex justify-between text-sm text-ink-muted"><span>Discount</span><span className="font-mono">−{fmt(selected.discount)}</span></div>
            )}
            <div className="flex justify-between font-bold text-lg border-t border-border pt-2 mt-2">
              <span>Total</span>
              <span className="font-mono">{selected.total < 0 ? "−" : ""}{fmt(selected.total)}</span>
            </div>
            {isRefund(selected) && selected.payment.reason && (
              <div className="text-sm text-ink-muted mt-2">Reason: {selected.payment.reason}</div>
            )}
            {!isRefund(selected) && (
              <button
                className="btn-primary w-full mt-4"
                onClick={() => { setRefunding(selected); setSelected(null); }}
              >
                <Undo2 size={18} /> Refund / return items
              </button>
            )}
          </>
        )}
      </Modal>

      <RefundModal
        sale={refunding}
        onClose={() => setRefunding(null)}
        onDone={() => { setRefunding(null); load(); }}
      />
    </div>
  );
}
