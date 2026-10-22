import { useEffect, useState } from "react";
import { useReports } from "../stores/reportStore";
import { useApp } from "../stores/appStore";
import { reportToCSV, downloadCSV } from "../lib/reports";
import { Calendar, Download, FileText, Filter } from "lucide-react";
import { localDateKey } from "../lib/dates";

export default function Reports() {
  const counter = useApp((s) => s.counter);
  const { report, loading, load, range, setRange, setCustomRange } = useReports();
  const [activeTab, setActiveTab] = useState("summary");
  const [fromDate, setFromDate] = useState(localDateKey());
  const [toDate, setToDate] = useState(localDateKey());

  useEffect(() => {
    load();
  }, [counter, range]);

  const applyCustom = () => {
    const from = new Date(`${fromDate}T00:00:00`).getTime();
    const to = new Date(`${toDate}T23:59:59.999`).getTime();
    setCustomRange(from, to);
  };

  const handleExport = () => {
    if (!report) return;
    const csv = reportToCSV(report);
    const ts = localDateKey();
    downloadCSV(`rozy-report-${range}-${ts}.csv`, csv);
  };

  if (loading || !report) {
    return (
      <div className="h-full flex items-center justify-center text-ink-muted">
        Loading report...
      </div>
    );
  }

  const { billCount, totalSales, totalDiscount, avgBill, payment, topItems, byCategory, daily } = report;

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[200px]">
                    <h1 className="font-serif text-xl sm:text-2xl text-primary font-semibold">Reports</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            {billCount} bills · ₹{totalSales.toFixed(2)} total
          </p>
        </div>
        <button onClick={handleExport} className="btn-outline text-sm">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Range selector */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={16} className="text-ink-muted" />
          {[
            { k: "today", label: "Today" },
            { k: "week", label: "This Week" },
            { k: "month", label: "This Month" },
          ].map((r) => (
            <button
              key={r.k}
              onClick={() => setRange(r.k)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                range === r.k
                  ? "bg-primary text-white shadow-warm"
                  : "bg-bg/45 text-ink hover:bg-primary-light"
              }`}
            >
              {r.label}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date"
              className="input py-1.5 text-xs"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span className="text-ink-muted text-xs">to</span>
            <input
              type="date"
              className="input py-1.5 text-xs"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            <button onClick={applyCustom} className="btn-primary py-1.5 px-3 text-xs">
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {[
          { k: "summary", label: "Summary" },
          { k: "items", label: "Items" },
          { k: "categories", label: "Categories" },
          { k: "daily", label: "Daily" },
        ].map((tab) => (
          <button
            key={tab.k}
            onClick={() => setActiveTab(tab.k)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
              activeTab === tab.k
                ? "bg-primary text-white shadow-warm"
                : "bg-surface/70 border border-border text-ink hover:bg-primary-light"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      {activeTab === "summary" && (
        <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <SummaryCard label="Total Sales" value={`₹${totalSales.toFixed(2)}`} />
            <SummaryCard label="Bills" value={billCount} />
            <SummaryCard label="Average Bill" value={`₹${avgBill.toFixed(2)}`} />
            <SummaryCard label="Total Discount" value={`₹${totalDiscount.toFixed(2)}`} />
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-ink mb-4">Payment Breakdown</h2>
            <div className="space-y-3">
              <PaymentRow label="Cash" amount={payment.cash} total={totalSales} color="success" />
              <PaymentRow label="UPI" amount={payment.upi} total={totalSales} color="accent" />
              <PaymentRow label="Card" amount={payment.card} total={totalSales} color="primary" />
            </div>
          </div>
        </div>
      )}

      {/* Items */}
      {activeTab === "items" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/45">
                <tr className="text-left">
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase">#</th>
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase">Item</th>
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase text-right">Qty</th>
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase">Unit</th>
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((it, i) => (
                  <tr key={it.name} className="border-t border-border hover:bg-bg/50">
                    <td className="p-3 text-ink-muted">{i + 1}</td>
                    <td className="p-3 font-semibold">{it.name}</td>
                    <td className="p-3 text-right font-mono">{it.qty}</td>
                    <td className="p-3 text-ink-muted">{it.unit}</td>
                    <td className="p-3 text-right font-mono font-semibold text-primary">
                      ₹{it.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {topItems.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-ink-faint">
                      No sales in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Categories */}
      {activeTab === "categories" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/45">
                <tr className="text-left">
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase">Category</th>
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase text-right">Qty</th>
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase text-right">Revenue</th>
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((c) => (
                  <tr key={c.category} className="border-t border-border hover:bg-bg/50">
                    <td className="p-3 font-semibold">{c.category}</td>
                    <td className="p-3 text-right font-mono">{c.qty.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-semibold text-primary">
                      ₹{c.revenue.toFixed(2)}
                    </td>
                    <td className="p-3 text-right text-ink-muted">
                      {totalSales > 0 ? ((c.revenue / totalSales) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
                {byCategory.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-ink-faint">
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily */}
      {activeTab === "daily" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/45">
                <tr className="text-left">
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase">Date</th>
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase text-right">Bills</th>
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase text-right">Revenue</th>
                  <th className="p-3 font-semibold text-ink-muted text-xs uppercase text-right">Avg Bill</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((d) => (
                  <tr key={d.date} className="border-t border-border hover:bg-bg/50">
                    <td className="p-3 font-semibold">
                      {new Date(d.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-3 text-right font-mono">{d.bills}</td>
                    <td className="p-3 text-right font-mono font-semibold text-primary">
                      ₹{d.revenue.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono text-ink-muted">
                      ₹{(d.bills ? d.revenue / d.bills : 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {daily.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-ink-faint">
                      No sales in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-ink-muted uppercase tracking-wider font-semibold">
        {label}
      </div>
      <div className="font-mono text-xl font-bold text-primary mt-1">{value}</div>
    </div>
  );
}

function PaymentRow({ label, amount, total, color }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  const colorMap = {
    success: "bg-success",
    accent: "bg-accent",
    primary: "bg-primary",
  };
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-semibold">{label}</span>
        <span className="font-mono">
          ₹{amount.toFixed(2)}{" "}
          <span className="text-ink-muted">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-2 bg-bg/45 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorMap[color]} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}