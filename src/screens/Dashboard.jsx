import { useEffect, useState } from "react";
import { useReports } from "../stores/reportStore";
import { useApp } from "../stores/appStore";
import { useShop } from "../stores/shopStore";
import { useTranslation } from "react-i18next";
import {
  TrendingUp, Receipt, Calendar, AlertTriangle,
  IndianRupee, Award, PieChart as PieIcon, Store,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { db } from "../lib/db";

const COLORS = ["#8B1E1E", "#D4A017", "#2D7A4F", "#2980B9", "#E67E22"];

export default function Dashboard() {
  const { t } = useTranslation();
  const counter = useApp((s) => s.counter);
  const user = useApp((s) => s.user);
  const { shops } = useShop();
  const { report, loading, load, range, setRange } = useReports();
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    load();
    (async () => {
      const products = await db.products.toArray();
      const low = products.filter((p) => (p.stock || 0) <= (p.lowStock || 0));
      setLowStock(low);
    })();
  }, [counter, range]);

  if (loading || !report) {
    return (
      <div className="h-full flex items-center justify-center text-ink-muted">
        Loading dashboard...
      </div>
    );
  }

  const {
    totalSales, billCount, avgBill, payment, topItems, byCategory,
    hourly, daily, byShop,
  } = report;

  // Chart data
  const hourlyData = hourly.map((v, i) => ({
    hour: `${String(i).padStart(2, "0")}:00`,
    sales: parseFloat(v.toFixed(2)),
  }));

  const dailyData = daily.map((d) => ({
    day: new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    sales: parseFloat(d.revenue.toFixed(2)),
    bills: d.bills,
  }));

  const paymentData = [
    { name: "Cash", value: payment.cash },
    { name: "UPI", value: payment.upi },
    { name: "Card", value: payment.card },
  ].filter((x) => x.value > 0);

  const categoryData = byCategory.slice(0, 6).map((c) => ({
    name: c.category,
    revenue: parseFloat(c.revenue.toFixed(2)),
  }));

  const topFive = topItems.slice(0, 5);

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl sm:text-2xl font-semibold" style={{ color: "#8B1E1E" }}>
            {t("dashboard")}
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            {user.role === "owner" ? "Owner view · Both shops" : `Cashier · ${counter}`}
          </p>
        </div>

        {/* Range selector */}
        <div
          className="flex gap-1 rounded-xl p-1 overflow-x-auto max-w-full"
          style={{
            background: "#FFF8E7",
            border: "1px solid #B8935A",
          }}
        >
          {[
            { k: "today", label: "Today" },
            { k: "week", label: "Week" },
            { k: "month", label: "Month" },
          ].map((r) => (
            <button
              key={r.k}
              onClick={() => setRange(r.k)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                range === r.k ? "text-white" : "text-ink-muted hover:text-primary"
              }`}
              style={
                range === r.k
                  ? {
                      background: "linear-gradient(180deg, #A62626 0%, #8B1E1E 100%)",
                      boxShadow: "0 2px 6px rgba(139,30,30,0.3)",
                    }
                  : {}
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-6">
        <StatCard
          icon={<IndianRupee size={20} />}
          label="Total Sales"
          value={`₹${totalSales.toFixed(0)}`}
          color="primary"
        />
        <StatCard
          icon={<Receipt size={20} />}
          label="Bills"
          value={billCount}
          color="accent"
        />
        <StatCard
          icon={<Calendar size={20} />}
          label="Avg Bill"
          value={`₹${avgBill.toFixed(0)}`}
          color="success"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Low Stock"
          value={lowStock.length}
          color={lowStock.length > 0 ? "warning" : "success"}
        />
      </div>

      {/* Payment split + Category split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-4 flex items-center gap-2">
            <PieIcon size={16} className="text-primary" /> Payment Split
          </h2>
          {paymentData.length === 0 ? (
            <div className="text-center py-8 text-ink-faint text-sm">No data yet</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={paymentData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(e) => `${e.name}: ₹${e.value.toFixed(0)}`}
                  >
                    {paymentData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => `₹${v.toFixed(2)}`}
                    contentStyle={{
                      background: "#FFF8E7",
                      border: "1px solid #B8935A",
                      borderRadius: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-4">Category Revenue</h2>
          {categoryData.length === 0 ? (
            <div className="text-center py-8 text-ink-faint text-sm">No data yet</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v) => `₹${v.toFixed(2)}`}
                    contentStyle={{
                      background: "#FFF8E7",
                      border: "1px solid #B8935A",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="revenue" fill="#8B1E1E" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Sales trend — switches between hourly and daily based on range */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-ink mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" />
          {range === "today" ? "Hourly Sales (Today)" : "Daily Sales"}
        </h2>
        <div className="h-64">
          <ResponsiveContainer>
            {range === "today" ? (
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD3" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => `₹${v.toFixed(2)}`}
                  contentStyle={{
                    background: "#FFF8E7",
                    border: "1px solid #B8935A",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#8B1E1E"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#8B1E1E" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            ) : (
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8DFD3" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  interval={range === "month" ? 2 : 0}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v) => `₹${v.toFixed(2)}`}
                  contentStyle={{
                    background: "#FFF8E7",
                    border: "1px solid #B8935A",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="sales" fill="#D4A017" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Shop comparison — when viewing Both and owner */}
      {user.role === "owner" && byShop && byShop.length > 1 && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-ink mb-4 flex items-center gap-2">
            <Store size={16} className="text-primary" /> Shop Comparison
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {byShop.map((s) => {
              const shop = shops.find((sh) => sh.id === s.shopId);
              return (
                <div key={s.shopId} className="bg-bg rounded-xl p-3 sm:p-4">
                  <div className="text-xs text-ink-muted uppercase font-semibold">
                    {shop?.shortName || s.shopId}
                  </div>
                  <div className="font-mono text-lg sm:text-xl font-bold text-primary mt-1">
                    ₹{s.revenue.toFixed(0)}
                  </div>
                  <div className="text-xs text-ink-muted mt-1">
                    {s.bills} bills
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top items */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-ink mb-4 flex items-center gap-2">
          <Award size={16} className="text-accent" /> Top 5 Sellers
        </h2>
        {topFive.length === 0 ? (
          <div className="text-center py-6 text-ink-faint text-sm">No sales yet</div>
        ) : (
          <div className="space-y-2">
            {topFive.map((it, i) => (
              <div key={it.name} className="flex items-center gap-3 p-3 bg-bg rounded-xl">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center
                              text-sm font-bold flex-shrink-0 ${
                                i === 0
                                  ? "bg-accent text-white"
                                  : i === 1
                                  ? "bg-primary text-white"
                                  : "bg-border text-ink"
                              }`}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{it.name}</div>
                  <div className="text-xs text-ink-muted">
                    {it.qty} {it.unit} sold
                  </div>
                </div>
                <div className="font-mono font-bold text-primary text-sm">
                  ₹{it.revenue.toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Low stock alert list */}
      {lowStock.length > 0 && (
        <div className="card p-5" style={{ borderColor: "#E67E22" }}>
          <h2 className="font-semibold text-warning mb-4 flex items-center gap-2">
            <AlertTriangle size={16} /> Low Stock Alerts
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {lowStock.slice(0, 12).map((p) => (
              <div key={p.id} className="bg-bg rounded-lg p-3">
                <div className="font-semibold text-sm truncate">{p.name}</div>
                <div className="text-xs text-warning font-mono mt-1">
                  {p.stock} {p.unit} left
                </div>
              </div>
            ))}
          </div>
          {lowStock.length > 12 && (
            <div className="text-xs text-ink-muted mt-3 text-center">
              +{lowStock.length - 12} more items
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  const colorMap = {
    primary: "bg-primary-light text-primary",
    accent: "bg-accent-light text-accent",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  };
  return (
    <div className="card p-3 sm:p-4">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-2 sm:mb-3 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="text-[10px] sm:text-xs text-ink-muted uppercase tracking-wider font-semibold">
        {label}
      </div>
      <div className="font-mono text-base sm:text-xl font-bold text-ink mt-1">{value}</div>
    </div>
  );
}