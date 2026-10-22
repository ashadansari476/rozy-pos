import { useEffect, useState } from "react";
import { useShop } from "../stores/shopStore";
import { getExpenses, getExpenseSummary, deleteExpense, EXPENSE_CATEGORIES } from "../lib/owner";
import ExpenseModal from "../components/expenses/ExpenseModal";
import { Wallet, Plus, Search, Edit2, Trash2, Calendar } from "lucide-react";

export default function Expenses() {
  const { currentShopId } = useShop();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [range, setRange] = useState("month");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    let from = null;

    if (range === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      from = d.getTime();
    } else if (range === "week") {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      from = d.getTime();
    } else if (range === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    const [list, summ] = await Promise.all([
      getExpenses({ shopId: currentShopId, from }),
      getExpenseSummary({ shopId: currentShopId, from }),
    ]);
    setExpenses(list);
    setSummary(summ);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [currentShopId, range]);

  const handleDelete = async (e) => {
    if (!confirm(`Delete this ₹${e.amount} expense?`)) return;
    await deleteExpense(e.id);
    await load();
  };

  const openEdit = (e) => {
    setEditing(e);
    setShowModal(true);
  };

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const getCat = (key) => EXPENSE_CATEGORIES.find((c) => c.key === key) || EXPENSE_CATEGORIES[7];

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 lg:p-6 pb-4 border-b border-border bg-surface/70">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <h1 className="font-serif text-2xl text-primary font-semibold flex items-center gap-2">
              <Wallet size={24} /> Expenses
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              Track shop expenses for true profit calculation
            </p>
          </div>
          <button onClick={openAdd} className="btn-primary text-sm">
            <Plus size={16} /> Add Expense
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { k: "today", label: "Today" },
            { k: "week", label: "This Week" },
            { k: "month", label: "This Month" },
          ].map((r) => (
            <button
              key={r.k}
              onClick={() => setRange(r.k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                range === r.k
                  ? "bg-primary text-white shadow-warm"
                  : "bg-bg/45 text-ink hover:bg-primary-light"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {loading ? (
          <div className="text-center py-20 text-ink-muted">Loading...</div>
        ) : (
          <>
            {/* Summary */}
            {summary && summary.total > 0 && (
              <div className="card p-5 mb-5">
                <div className="text-xs text-ink-muted uppercase tracking-wider">
                  Total ({range})
                </div>
                <div className="font-mono text-3xl font-bold text-primary mt-1">
                  ₹{summary.total.toFixed(2)}
                </div>
                <div className="text-xs text-ink-muted mt-1">
                  {summary.count} entr{summary.count === 1 ? "y" : "ies"}
                </div>
              </div>
            )}

            {/* Category breakdown */}
            {summary && Object.keys(summary.byCategory).length > 0 && (
              <div className="card p-5 mb-5">
                <h2 className="font-semibold text-ink mb-3">By Category</h2>
                <div className="space-y-2">
                  {Object.entries(summary.byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([key, amount]) => {
                      const cat = getCat(key);
                      const pct = (amount / summary.total) * 100;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-semibold">
                              {cat.icon} {cat.label}
                            </span>
                            <span className="font-mono">₹{amount.toFixed(2)} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-1.5 bg-bg/45 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* List */}
            {expenses.length === 0 ? (
              <div className="card p-12 text-center">
                <Wallet size={48} className="mx-auto text-ink-faint mb-4" />
                <h2 className="font-serif text-xl text-primary font-semibold mb-2">
                  No expenses
                </h2>
                <p className="text-ink-muted text-sm mb-5">
                  Log your first expense to track true profit.
                </p>
                <button onClick={openAdd} className="btn-primary">
                  <Plus size={16} /> Add Expense
                </button>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-bg/45">
                    <tr className="text-left">
                      <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Date</th>
                      <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Category</th>
                      <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Note</th>
                      <th className="p-3 text-xs uppercase text-ink-muted font-semibold text-right">Amount</th>
                      <th className="p-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => {
                      const cat = getCat(e.category);
                      return (
                        <tr key={e.id} className="border-t border-border hover:bg-bg/50">
                          <td className="p-3 text-xs text-ink-muted whitespace-nowrap">
                            {new Date(e.ts).toLocaleDateString("en-IN", {
                              day: "2-digit", month: "short",
                            })}
                          </td>
                          <td className="p-3">
                            <span className="font-semibold">
                              {cat.icon} {cat.label}
                            </span>
                          </td>
                          <td className="p-3 text-ink-muted text-xs">{e.note || "—"}</td>
                          <td className="p-3 text-right font-mono font-semibold text-danger">
                            ₹{e.amount.toFixed(2)}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => openEdit(e)}
                                className="p-1.5 text-ink-muted hover:text-primary hover:bg-primary-light rounded"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(e)}
                                className="p-1.5 text-ink-muted hover:text-danger hover:bg-danger/10 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              </div>
            )}
          </>
        )}
      </div>

      <ExpenseModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        expense={editing}
        onSaved={load}
      />
    </div>
  );
}