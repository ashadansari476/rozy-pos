import { Outlet, NavLink } from "react-router-dom";
import { useApp } from "../stores/appStore";
import { useShop } from "../stores/shopStore";
import { useTranslation } from "react-i18next";
import {
  ShoppingCart, LayoutDashboard, Package, Boxes, Truck, Users,
  ClipboardList, BarChart3, Wallet, Target, FileText, Settings,
  LogOut, Menu, X, Globe, Store, Calculator,
} from "lucide-react";
import { useState, useEffect } from "react";
import { scheduleOrderAlerts } from "../lib/orderAlerts";
import SyncIndicator from "../components/ui/SyncIndicator";
import { startAutoSync, setupNetworkListeners, isSyncConfigured } from "../lib/syncEngine";
import { useSync } from "../stores/syncStore";
import OfflineBanner from "../components/ui/OfflineBanner";
import { filterNavByPermissions, canSwitchShops } from "../lib/permissions";
import BackupReminder from "../components/ui/BackupReminder";

const NAV = [
  { to: "/billing",   icon: ShoppingCart,    key: "billing" },
  { to: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { to: "/day-end",   icon: Calculator,      key: "day_end" },
  { to: "/compare",   icon: Store,           key: "compare", ownerOnly: true },
  { to: "/products",  icon: Package,         key: "products" },
  { to: "/inventory", icon: Boxes,           key: "inventory" },
  { to: "/suppliers", icon: Truck,           key: "suppliers" },
  { to: "/customers", icon: Users,           key: "customers" },
  { to: "/orders",    icon: ClipboardList,   key: "orders" },
  { to: "/reports",   icon: BarChart3,       key: "reports" },
  { to: "/expenses",  icon: Wallet,          key: "expenses" },
  { to: "/targets",   icon: Target,          key: "targets" },
  { to: "/audit",     icon: FileText,        key: "audit" },
  { to: "/settings",  icon: Settings,        key: "settings" },
];

export default function AppShell() {
  const { t, i18n } = useTranslation();
  const user = useApp((s) => s.user);
  const logout = useApp((s) => s.logout);
  const { shops, currentShop, currentShopId, switchShop, loadShops } = useShop();
  const [mobileNav, setMobileNav] = useState(false);

     useEffect(() => {
    loadShops();
    scheduleOrderAlerts();

    // Start auto sync (every 5 min + on app open)
    if (isSyncConfigured()) {
      startAutoSync();
    }

    // Listen for online/offline
    setupNetworkListeners(
      () => console.log("🟢 Back online"),
      () => console.log("🔴 Offline")
    );
  }, []);

  useEffect(() => {
    if (currentShopId) {
      import("../stores/productStore").then(({ useProducts }) => {
        useProducts.getState().load(currentShopId);
      });
    }
  }, [currentShopId]);

  const isOwner = user?.role === "owner";

  const cycleLang = () => {
    const order = ["en", "hi", "ne"];
    const next = order[(order.indexOf(i18n.language) + 1) % order.length];
    i18n.changeLanguage(next);
    useApp.getState().setLanguage(next);
  };

  const availableShops = isOwner ? shops : shops.filter((s) => s.id === user?.shopId);

  return (
    <div className="h-screen flex bg-bg">
      {/* Sidebar */}
            <aside
          className={`${mobileNav ? "fixed inset-y-0 left-0 z-50 w-64" : "hidden xl:flex"}
                     xl:static xl:w-64 flex-shrink-0 wood-sidebar
                     flex-col transition-all`}
          style={{
            maxHeight: "100vh",
            overflowY: "hidden",
          }}
        >
                <div className="p-4" style={{ borderBottom: "1px solid rgba(107, 68, 35, 0.25)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl2 flex items-center justify-center text-xl"
                 style={{
                   background: "linear-gradient(180deg, #8B1E1E 0%, #6B1515 100%)",
                   boxShadow: "0 3px 10px rgba(107, 21, 21, 0.4), inset 0 1px 0 rgba(255,255,255,0.15)"
                 }}>
              🧁
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-serif font-bold text-lg truncate"
                   style={{ color: "#3A2410", textShadow: "0 1px 0 rgba(255,255,255,0.3)" }}>
                {currentShop?.shortName || "POS"}
              </div>
              <div className="text-xs truncate" style={{ color: "#6B4423" }}>
                {currentShop?.address || "Sukhia Pokhri"}
              </div>
            </div>
                        <button
              onClick={() => setMobileNav(false)}
              className="xl:hidden text-ink p-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <nav
          className="flex-1 overflow-y-auto p-2"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
                    {filterNavByPermissions(user, NAV).map(({ to, icon: Icon, key, ownerOnly }) => {
            if (ownerOnly && !isOwner) return null;
            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileNav(false)}
                                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 font-semibold text-sm transition-all ${
                    isActive
                      ? "text-white"
                      : "hover:bg-white/20"
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        background: "linear-gradient(180deg, #8B1E1E 0%, #6B1515 100%)",
                        boxShadow: "0 3px 10px rgba(107, 21, 21, 0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                        color: "#FFF8E7",
                      }
                    : { color: "#3A2410" }
                }
              >
                <Icon size={18} />
                <span>{t(key) || key}</span>
              </NavLink>
            );
          })}
        </nav>

                <div className="p-3" style={{ borderTop: "1px solid rgba(107, 68, 35, 0.25)" }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-accent-light text-accent font-bold
                            flex items-center justify-center text-sm">
              {user.username[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink truncate">{user.username}</div>
              <div className="text-xs text-ink-muted capitalize">
                {user.role}
                {user.shopId && ` · ${shops.find((s) => s.id === user.shopId)?.shortName || ""}`}
              </div>
            </div>
          </div>
          <button onClick={logout} className="btn-outline w-full py-2 text-sm">
            <LogOut size={14} /> {t("logout")}
          </button>
        </div>
      </aside>

            {mobileNav && (
        <div className="fixed inset-0 bg-black/30 z-40 xl:hidden"
             onClick={() => setMobileNav(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
                <header className="h-14 px-3 lg:px-5 flex items-center gap-2 wood-header">
                    <button
            onClick={() => setMobileNav(true)}
            className="xl:hidden p-2 text-white hover:bg-white/20 rounded-lg flex-shrink-0"
          >
            <Menu size={22} />
          </button>

                    {/* Current Shop Name */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink">
            <Store size={16} className="text-white/80 flex-shrink-0 hidden sm:block" />
            <span className="font-serif font-semibold text-white truncate text-sm lg:text-base">
              {currentShop?.shortName || "Rozy POS"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {/* Shop switcher — owner only, always visible */}
                        {canSwitchShops(user) && availableShops.length > 1 && (
              <div className="flex items-center rounded-xl p-1"
                   style={{ background: "rgba(0,0,0,0.25)" }}>
                {availableShops.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => switchShop(s.id)}
                    className={`px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                      currentShopId === s.id
                        ? "text-white"
                        : "text-white/70 hover:text-white"
                    }`}
                    style={
                      currentShopId === s.id
                        ? {
                            background: "linear-gradient(180deg, #A62626 0%, #8B1E1E 100%)",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
                          }
                        : {}
                    }
                  >
                    {s.shortName}
                  </button>
                ))}
              </div>
            )}
            {/* Sync status */}
            <SyncIndicator />

                        {/* Language */}
            <button
              onClick={cycleLang}
              className="px-2 sm:px-3 py-2 text-xs uppercase font-bold flex-shrink-0 rounded-lg transition hover:bg-white/15"
              style={{ color: "#FFF8E7" }}
              title="Switch language"
            >
              <Globe size={16} className="inline" /> <span className="hidden sm:inline">{i18n.language}</span>
            </button>
          </div>
        </header>

        <OfflineBanner />
        <BackupReminder />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}