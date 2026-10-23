import { useEffect, useState } from "react";
import { useInventory } from "../stores/inventoryStore";
import { useApp } from "../stores/appStore";
import { useShop } from "../stores/shopStore";
import StockAdjustModal from "../components/inventory/StockAdjustModal";
import WastageModal from "../components/inventory/WastageModal";
import ExpiryBadge from "../components/inventory/ExpiryBadge";
import {
  Boxes, Search, AlertTriangle, TrendingUp, Package,
  Edit2, Trash2, Calendar, IndianRupee,
} from "lucide-react";
import { markBatchExpired } from "../lib/inventory";
import SearchInput from "../components/ui/SearchInput";

export default function Inventory() {
  const user = useApp((s) => s.user);
  const {
    products, stats, movements, expiring, expired, profit, loading, loadAll,
  } = useInventory();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | low | out | expiring
  const [adjusting, setAdjusting] = useState(null);
  const [wasting, setWasting] = useState(null);
  const [tab, setTab] = useState("stock"); // stock | movements | wastage | expiry

  const { currentShopId } = useShop();

  // reload whenever the shop changes, so each shop always sees its own stock
  useEffect(() => {
    loadAll();
  }, [currentShopId]);

  const filtered = products.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.barcode || "").includes(q)) return false;
    }
    if (filter === "low") return p.stock > 0 && p.stock <= (p.lowStock || 0);
    if (filter === "out") return p.stock === 0;
    if (filter === "expiring") {
      return expiring.some((e) => e.productId === p.id);
    }
    return true;
  });

  const handleExpire = async (batchId) => {
    if (!confirm("Mark this batch as expired? Stock will be deducted and logged as wastage.")) return;
    await markBatchExpired(batchId, user.username);
    loadAll();
  };

  if (loading || !stats) {
    return (
      <div className="h-full flex items-center justify-center text-ink-muted">
        Loading inventory...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 lg:p-6 pb-4 border-b border-border bg-surface/70">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <h1 className="font-serif text-2xl text-primary font-semibold flex items-center gap-2">
              <Boxes size={24} /> Inventory
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              {stats.totalProducts} products · {stats.lowCount} low · {stats.outCount} out of stock
            </p>
          </div>
        </div>

        {/* Stat cards */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-4">
          <SmallStat icon={<IndianRupee size={14} />} label="Stock Value (cost)" value={`₹${stats.totalValue.toFixed(0)}`} />
          <SmallStat icon={<TrendingUp size={14} />} label="Retail Value" value={`₹${stats.retailValue.toFixed(0)}`} />
          <SmallStat icon={<Package size={14} />} label="Low Stock" value={stats.lowCount} warn={stats.lowCount > 0} />
          <SmallStat icon={<AlertTriangle size={14} />} label="Out of Stock" value={stats.outCount} warn={stats.outCount > 0} />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { k: "stock", label: "📦 Stock" },
            { k: "expiry", label: `⏰ Expiry (${expiring.length + expired.length})` },
            { k: "movements", label: "📊 Movements" },
            { k: "wastage", label: "🗑️ Wastage" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                tab === t.k
                  ? "bg-primary text-white shadow-warm"
                  : "bg-bg/45 text-ink hover:bg-primary-light"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {tab === "stock" && (
          <>
            {/* Search + filters */}
            <div className="flex flex-wrap gap-2 mb-4">
                            <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search products..."
                className="flex-1 min-w-[200px]"
              />
              {[
                { k: "all", label: "All" },
                { k: "low", label: `Low (${stats.lowCount})` },
                { k: "out", label: `Out (${stats.outCount})` },
                { k: "expiring", label: `Expiring (${expiring.length})` },
              ].map((f) => (
                <button
                  key={f.k}
                  onClick={() => setFilter(f.k)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    filter === f.k
                      ? "bg-primary text-white"
                      : "bg-bg/45 text-ink hover:bg-primary-light"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-bg/45">
                    <tr className="text-left">
                      <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Product</th>
                      <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Category</th>
                      <th className="p-3 text-xs uppercase text-ink-muted font-semibold text-right">Stock</th>
                      <th className="p-3 text-xs uppercase text-ink-muted font-semibold text-right">Cost</th>
                      <th className="p-3 text-xs uppercase text-ink-muted font-semibold text-right">Price</th>
                      <th className="p-3 text-xs uppercase text-ink-muted font-semibold text-right">Value</th>
                      <th className="p-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const low = p.stock > 0 && p.stock <= (p.lowStock || 0);
                      const out = p.stock === 0;
                      const value = (p.cost || 0) * p.stock;
                      return (
                        <tr key={p.id} className="border-t border-border hover:bg-bg/50">
                          <td className="p-3">
                            <div className="font-semibold">{p.name}</div>
                            {p.barcode && (
                              <div className="text-xs text-ink-faint font-mono">{p.barcode}</div>
                            )}
                          </td>
                          <td className="p-3 text-ink-muted">{p.category}</td>
                          <td className="p-3 text-right font-mono">
                            <span
                              className={`font-semibold ${
                                out ? "text-danger" : low ? "text-warning" : ""
                              }`}
                            >
                              {p.stock} {p.unit}
                            </span>
                            {(low || out) && (
                              <AlertTriangle
                                size={12}
                                className={`inline ml-1 ${out ? "text-danger" : "text-warning"}`}
                              />
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-ink-muted">
                            {p.cost ? `₹${p.cost}` : "—"}
                          </td>
                          <td className="p-3 text-right font-mono">₹{p.price}</td>
                          <td className="p-3 text-right font-mono text-primary font-semibold">
                            {value > 0 ? `₹${value.toFixed(0)}` : "—"}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => setAdjusting(p)}
                                className="p-1.5 text-ink-muted hover:text-primary hover:bg-primary-light rounded"
                                title="Adjust stock"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => setWasting(p)}
                                className="p-1.5 text-ink-muted hover:text-warning hover:bg-warning/10 rounded"
                                title="Record wastage"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-ink-faint">
                          No products match your filter
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "expiry" && (
          <div className="space-y-4">
            {expired.length > 0 && (
              <div className="card p-4 border-danger/40">
                <h2 className="font-semibold text-danger mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} /> Expired Batches ({expired.length})
                </h2>
                <div className="space-y-2">
                  {expired.map((b) => (
                    <div key={b.id} className="bg-bg/45 rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{b.productName}</div>
                        <div className="text-xs text-ink-muted">
                          {b.qty} {b.unit} · {b.batchNo || `batch #${b.id}`}
                        </div>
                      </div>
                      <ExpiryBadge expiryDate={b.expiryDate} />
                      <button
                        onClick={() => handleExpire(b.id)}
                        className="btn-primary py-1.5 px-3 text-xs"
                      >
                        Mark as wasted
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card p-4">
              <h2 className="font-semibold text-warning mb-3 flex items-center gap-2">
                <Calendar size={16} /> Expiring Soon ({expiring.length})
              </h2>
              {expiring.length === 0 ? (
                <div className="text-center py-6 text-ink-faint text-sm">
                  No items expiring in next 3 days ✅
                </div>
              ) : (
                <div className="space-y-2">
                  {expiring.map((b) => (
                    <div key={b.id} className="bg-bg/45 rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{b.productName}</div>
                        <div className="text-xs text-ink-muted">
                          {b.qty} {b.unit} · {b.batchNo || `batch #${b.id}`}
                        </div>
                      </div>
                      <ExpiryBadge expiryDate={b.expiryDate} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "movements" && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg/45">
                  <tr className="text-left">
                    <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Time</th>
                    <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Product</th>
                    <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Change</th>
                    <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Reason</th>
                    <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Note</th>
                    <th className="p-3 text-xs uppercase text-ink-muted font-semibold text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.slice(0, 100).map((m) => (
                    <tr key={m.id} className="border-t border-border hover:bg-bg/50">
                      <td className="p-3 text-xs text-ink-muted whitespace-nowrap">
                        {new Date(m.ts).toLocaleString("en-IN", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </td>
                      <td className="p-3 font-semibold">{m.productName}</td>
                      <td className={`p-3 font-mono font-semibold ${m.qty > 0 ? "text-success" : "text-danger"}`}>
                        {m.qty > 0 ? "+" : ""}{m.qty} {m.unit}
                      </td>
                      <td className="p-3 text-xs capitalize text-ink-muted">{m.reason}</td>
                      <td className="p-3 text-xs text-ink-muted">{m.note}</td>
                      <td className="p-3 text-right font-mono">{m.balanceAfter} {m.unit}</td>
                    </tr>
                  ))}
                  {movements.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-ink-faint">
                        No stock movements yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "wastage" && (
          <WastageTab />
        )}
      </div>

      <StockAdjustModal
        open={!!adjusting}
        onClose={() => setAdjusting(null)}
        product={adjusting}
        onSaved={loadAll}
      />

      <WastageModal
        open={!!wasting}
        onClose={() => setWasting(null)}
        product={wasting}
        onSaved={loadAll}
      />
    </div>
  );
}

function SmallStat({ icon, label, value, warn }) {
  return (
    <div className="card p-2 sm:p-3">
      <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${
        warn ? "text-warning" : "text-ink-muted"
      }`}>
        {icon} <span className="hidden sm:inline">{label}</span>
      </div>
      <div className={`font-mono text-base sm:text-lg font-bold mt-1 ${warn ? "text-warning" : "text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

function WastageTab() {
  const [wastage, setWastage] = useState([]);
  const [range, setRange] = useState("month");

  useEffect(() => {
    (async () => {
      const { getWastage } = await import("../lib/inventory");
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const data = await getWastage({ from: start });
      setWastage(data.sort((a, b) => b.ts - a.ts));
    })();
  }, [range]);

  const total = wastage.reduce((s, w) => s + (w.costValue || 0), 0);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="text-xs text-ink-muted uppercase tracking-wider font-semibold">
          This Month's Wastage Cost
        </div>
        <div className="font-mono text-3xl font-bold text-danger mt-1">
          ₹{total.toFixed(2)}
        </div>
        <div className="text-xs text-ink-muted mt-1">
          {wastage.length} entries
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg/45">
              <tr className="text-left">
                <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Date</th>
                <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Product</th>
                <th className="p-3 text-xs uppercase text-ink-muted font-semibold text-right">Qty</th>
                <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Reason</th>
                <th className="p-3 text-xs uppercase text-ink-muted font-semibold">Note</th>
                <th className="p-3 text-xs uppercase text-ink-muted font-semibold text-right">Cost Loss</th>
              </tr>
            </thead>
            <tbody>
              {wastage.map((w) => (
                <tr key={w.id} className="border-t border-border hover:bg-bg/50">
                  <td className="p-3 text-xs text-ink-muted whitespace-nowrap">
                    {new Date(w.ts).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short",
                    })}
                  </td>
                  <td className="p-3 font-semibold">{w.productName}</td>
                  <td className="p-3 text-right font-mono text-danger">
                    -{w.qty} {w.unit}
                  </td>
                  <td className="p-3 text-xs">{w.reason}</td>
                  <td className="p-3 text-xs text-ink-muted">{w.note}</td>
                  <td className="p-3 text-right font-mono text-danger font-semibold">
                    ₹{(w.costValue || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
              {wastage.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-ink-faint">
                    No wastage recorded 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}