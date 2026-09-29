import { useEffect, useState } from "react";
import { useShop } from "../stores/shopStore";
import { getAuditLog } from "../lib/owner";
import { FileText, Search, Filter } from "lucide-react";
import SearchInput from "../components/ui/SearchInput";

const ACTION_LABELS = {
  SALE_CREATED: { label: "Sale", color: "success" },
  STOCK_ADJUSTED: { label: "Stock", color: "accent" },
  EXPENSE_ADDED: { label: "Expense", color: "danger" },
  TARGET_SET: { label: "Target", color: "primary" },
  ORDER_CREATED: { label: "Order", color: "primary" },
  ORDER_COMPLETED: { label: "Order Done", color: "success" },
  ORDER_STATUS_CHANGED: { label: "Order", color: "accent" },
  DAY_STARTED: { label: "Day Open", color: "success" },
  DAY_ENDED: { label: "Day Close", color: "accent" },
};

export default function AuditLog() {
  const { currentShopId } = useShop();
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await getAuditLog({ shopId: currentShopId, limit: 500 });
      setLogs(data);
      setLoading(false);
    })();
  }, [currentShopId]);

  const filtered = logs.filter((l) => {
    if (filter !== "all" && l.action !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.user?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.entity?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  const getMeta = (action) => ACTION_LABELS[action] || { label: action, color: "primary" };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 lg:p-6 pb-4 border-b border-border bg-surface">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <h1 className="font-serif text-2xl text-primary font-semibold flex items-center gap-2">
              <FileText size={24} /> Audit Log
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              {logs.length} actions logged · Last 500 events
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === "all"
                ? "bg-primary text-white"
                : "bg-bg text-ink hover:bg-primary-light"
            }`}
          >
            All
          </button>
          {uniqueActions.slice(0, 8).map((a) => {
            const meta = getMeta(a);
            return (
              <button
                key={a}
                onClick={() => setFilter(a)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  filter === a
                    ? "bg-primary text-white"
                    : "bg-bg text-ink hover:bg-primary-light"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
                    <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search user, action..."
            className="flex-1 min-w-[180px]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {loading ? (
          <div className="text-center py-20 text-ink-muted">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText size={48} className="mx-auto text-ink-faint mb-4" />
            <p className="text-ink-muted text-sm">
              No audit entries yet. Actions will appear here as you use the app.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg">
                <tr className="text-left">
                  <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Time</th>
                  <th className="p-3 text-xs uppercase text-ink-muted font-semibold">User</th>
                  <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Action</th>
                  <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Entity</th>
                  <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const meta = getMeta(l.action);
                  const details = JSON.stringify(l.details || {});
                  const detailStr = details.length > 80 ? details.slice(0, 80) + "..." : details;
                  return (
                    <tr key={l.id} className="border-t border-border hover:bg-bg/50">
                      <td className="p-3 text-xs text-ink-muted whitespace-nowrap">
                        {new Date(l.ts).toLocaleString("en-IN", {
                          day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3 font-semibold text-xs">{l.user}</td>
                      <td className="p-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg bg-${meta.color}/10 text-${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-ink-muted">
                        {l.entity} {l.entityId ? `#${l.entityId}` : ""}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-ink-muted">
                        {detailStr === "{}" ? "—" : detailStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}