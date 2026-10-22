import { useEffect, useState } from "react";
import { useShop } from "../stores/shopStore";
import { getShopStats } from "../lib/shops";
import { buildReport, startOfDay, endOfDay } from "../lib/reports";
import {
  Store, TrendingUp, Package, Users, ShoppingCart,
  IndianRupee, Award,
} from "lucide-react";

export default function CompareShops() {
  const { shops } = useShop();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const today = new Date();
      const from = startOfDay(today);
      const to = endOfDay(today);

      const results = [];
      for (const shop of shops) {
        const [stats, report] = await Promise.all([
          getShopStats(shop.id),
          buildReport({ from, to, shopId: shop.id }),
        ]);
        results.push({
          shop,
          stats,
          todaySales: report.totalSales,
          todayBills: report.billCount,
          topItem: report.topItems[0] || null,
        });
      }
      setData(results);
      setLoading(false);
    })();
  }, [shops.length]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-ink-muted">
        Loading shops...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <h1 className="font-serif text-2xl text-primary font-semibold mb-1 flex items-center gap-2">
        <Store size={24} /> Compare Shops
      </h1>
      <p className="text-xs text-ink-muted mb-6">
        Side-by-side view · Today's performance + lifetime stats
      </p>

      <div className={`grid gap-4 ${shops.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
        {data.map(({ shop, stats, todaySales, todayBills, topItem }) => (
          <div key={shop.id} className="card p-5">
            {/* Shop header */}
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
              <div className="w-12 h-12 rounded-xl2 bg-primary text-white flex items-center justify-center text-xl flex-shrink-0">
                🧁
              </div>
              <div className="min-w-0">
                <div className="font-serif font-semibold text-lg text-primary truncate">
                  {shop.shortName}
                </div>
                <div className="text-xs text-ink-muted truncate">{shop.name}</div>
              </div>
            </div>

            {/* Today's numbers */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-accent-light rounded-xl p-3">
                <div className="text-xs text-ink-muted uppercase tracking-wider">
                  Today
                </div>
                <div className="font-mono text-xl font-bold text-accent mt-1">
                  ₹{todaySales.toFixed(0)}
                </div>
              </div>
              <div className="bg-bg/45 rounded-xl p-3">
                <div className="text-xs text-ink-muted uppercase tracking-wider">
                  Bills Today
                </div>
                <div className="font-mono text-xl font-bold text-ink mt-1">
                  {todayBills}
                </div>
              </div>
            </div>

            {/* Lifetime stats */}
            <div className="space-y-2">
              <StatRow
                icon={<IndianRupee size={14} />}
                label="Lifetime Sales"
                value={`₹${stats.totalSales.toFixed(0)}`}
              />
              <StatRow
                icon={<TrendingUp size={14} />}
                label="Total Bills"
                value={stats.salesCount}
              />
              <StatRow
                icon={<Package size={14} />}
                label="Products"
                value={stats.productCount}
              />
              <StatRow
                icon={<Users size={14} />}
                label="Customers"
                value={stats.customerCount}
              />
              <StatRow
                icon={<ShoppingCart size={14} />}
                label="Orders"
                value={stats.orderCount}
              />
            </div>

            {/* Top item today */}
            {topItem && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Award size={12} /> Top Item Today
                </div>
                <div className="bg-bg/45 rounded-lg p-2">
                  <div className="font-semibold text-sm">{topItem.name}</div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {topItem.qty.toFixed(2)} {topItem.unit} · ₹{topItem.revenue.toFixed(0)}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-ink-muted">
        {icon} {label}
      </span>
      <span className="font-mono font-semibold text-ink">{value}</span>
    </div>
  );
}