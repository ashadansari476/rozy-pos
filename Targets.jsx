import { useEffect, useState } from "react";
import { useShop } from "../stores/shopStore";
import { useApp } from "../stores/appStore";
import { setTarget, getTodayTarget, getTargetsInRange } from "../lib/owner";
import { db } from "../lib/db";
import { Target, TrendingUp, Check, Plus } from "lucide-react";
import { localDateKey } from "../lib/dates";

export default function Targets() {
  const { currentShopId, shops } = useShop();
  const user = useApp((s) => s.user);

  const [todayTarget, setTodayTarget] = useState(null);
  const [todaySales, setTodaySales] = useState(0);
  const [history, setHistory] = useState([]);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const load = async () => {
    // Today's target
    const target = await getTodayTarget(currentShopId);
    setTodayTarget(target);
    setInputValue(target?.amount ? String(target.amount) : "");

    // Today's sales
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    const sales = await db.sales.where("shopId").equals(currentShopId).toArray();
    const todaySalesList = sales.filter((s) => s.ts >= startOfDay && s.ts < endOfDay);
    const total = todaySalesList.reduce((s, x) => s + (x.total || 0), 0);
    setTodaySales(total);

    // History (last 30 days)
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromDate = localDateKey(from);
    const targets = await getTargetsInRange({
      shopId: currentShopId,
      from: fromDate,
    });

    // For each target, get actual sales
    const enriched = [];
    for (const t of targets) {
      const dayStart = new Date(t.date + "T00:00:00").getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const daySales = sales.filter((s) => s.ts >= dayStart && s.ts < dayEnd);
      const actual = daySales.reduce((s, x) => s + (x.total || 0), 0);
      enriched.push({
        ...t,
        actual,
        pct: t.amount > 0 ? (actual / t.amount) * 100 : 0,
      });
    }
    setHistory(enriched);
  };

  useEffect(() => {
    load();
  }, [currentShopId]);

  const handleSave = async () => {
    const amount = parseFloat(inputValue) || 0;
    if (amount <= 0) return alert("Enter valid amount");
    await setTarget({
      shopId: currentShopId,
      date: localDateKey(),
      amount,
      user: user.username,
    });
    setEditing(false);
    await load();
  };

  const progressPct = todayTarget?.amount ? (todaySales / todayTarget.amount) * 100 : 0;
  const clampedPct = Math.min(100, progressPct);

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl2 bg-primary-light text-primary flex items-center justify-center">
          <Target size={24} />
        </div>
        <div>
          <h1 className="font-serif text-2xl text-primary font-semibold">Daily Targets</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Set today's target and track progress
          </p>
        </div>
      </div>

      {/* Today */}
      <div className="card p-6 mb-6">
        <div className="text-xs text-ink-muted uppercase tracking-wider mb-2">
          Today · {shops.find((s) => s.id === currentShopId)?.shortName}
        </div>

        {!editing ? (
          <>
            <div className="flex items-end gap-3 mb-4">
              <div className="font-mono text-4xl font-bold text-primary">
                ₹{todaySales.toFixed(0)}
              </div>
              {todayTarget && (
                <div className="text-ink-muted pb-1">
                  / ₹{todayTarget.amount.toFixed(0)}
                </div>
              )}
            </div>

            {todayTarget ? (
              <>
                <div className="h-4 bg-bg/45 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${
                      progressPct >= 100 ? "bg-success" : progressPct >= 70 ? "bg-accent" : "bg-primary"
                    }`}
                    style={{ width: `${clampedPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className={progressPct >= 100 ? "text-success font-semibold" : ""}>
                    {progressPct.toFixed(0)}% achieved
                    {progressPct >= 100 && " 🎉"}
                  </span>
                  <span className="text-ink-muted">
                    {todaySales >= todayTarget.amount
                      ? `+₹${(todaySales - todayTarget.amount).toFixed(0)} above`
                      : `₹${(todayTarget.amount - todaySales).toFixed(0)} to go`}
                  </span>
                </div>
                <button
                  onClick={() => setEditing(true)}
                  className="btn-outline mt-4 text-xs"
                >
                  Change Target
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="btn-primary">
                <Plus size={16} /> Set Today's Target
              </button>
            )}
          </>
        ) : (
          <div>
            <label className="label">Set Target Amount (₹)</label>
            <input
              type="number"
              className="input font-mono text-2xl text-center"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="0"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditing(false)} className="btn-outline flex-1">
                Cancel
              </button>
              <button onClick={handleSave} className="btn-primary flex-1">
                <Check size={16} /> Save Target
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <h2 className="font-semibold text-ink mb-3 flex items-center gap-2">
        <TrendingUp size={16} className="text-primary" /> Last 30 Days
      </h2>

      {history.length === 0 ? (
        <div className="card p-8 text-center text-ink-muted text-sm">
          No targets set yet. Set your first one above!
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
            <thead className="bg-bg/45">
              <tr className="text-left">
                <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Date</th>
                <th className="p-3 text-xs uppercase text-ink-muted font-semibold text-right">Target</th>
                <th className="p-3 text-xs uppercase text-ink-muted font-semibold text-right">Actual</th>
                <th className="p-3 text-xs uppercase text-ink-muted font-semibold text-right">%</th>
                <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="p-3 text-xs">
                    {new Date(t.date).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", weekday: "short",
                    })}
                  </td>
                  <td className="p-3 text-right font-mono">₹{t.amount.toFixed(0)}</td>
                  <td className="p-3 text-right font-mono font-semibold text-primary">
                    ₹{t.actual.toFixed(0)}
                  </td>
                  <td className={`p-3 text-right font-mono font-semibold ${
                    t.pct >= 100 ? "text-success" : t.pct >= 70 ? "text-accent" : "text-danger"
                  }`}>
                    {t.pct.toFixed(0)}%
                  </td>
                  <td className="p-3">
                    {t.pct >= 100 ? (
                      <span className="text-xs text-success font-semibold">✓ Hit</span>
                    ) : (
                      <span className="text-xs text-ink-muted">Missed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}