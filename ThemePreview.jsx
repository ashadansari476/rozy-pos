import { useState } from "react";

export default function ThemePreview() {
  const [activeTheme, setActiveTheme] = useState("A");

  const themes = {
    A: {
      name: "Subtle Wood",
      desc: "Wood on header + sidebar only. Clean and modern.",
      headerBg: "linear-gradient(180deg, var(--edge-line) 0%, #A67F44 100%)",
      sidebarBg: "linear-gradient(180deg, var(--edge-soft) 0%, #C4A67E 100%)",
      pageBg: "#FAF3E8",
      cardBg: "#FFFCF7",
      cardBorder: "var(--base)",
      text: "#3A2410",
      textMuted: "#7A6040",
      primary: "#8B1E1E",
      accent: "#D4A017",
      accentLight: "#FFF7E0",
    },
    B: {
      name: "Full Wood",
      desc: "Rich wood texture everywhere. Traditional and warm.",
      headerBg: "linear-gradient(180deg, var(--edge-strong) 0%, var(--ink-muted) 100%)",
      sidebarBg: "linear-gradient(180deg, #A67F44 0%, var(--edge-strong) 100%)",
      pageBg: "linear-gradient(135deg, var(--base) 0%, var(--edge-soft) 100%)",
      cardBg: "var(--surface)",
      cardBorder: "var(--edge-line)",
      text: "#3A2410",
      textMuted: "var(--ink-muted)",
      primary: "#8B1E1E",
      accent: "#D4A017",
      accentLight: "#FFF2CC",
    },
    C: {
      name: "Wooden Accent Bands",
      desc: "Wood strips top + bottom. Modern clean middle.",
      headerBg: "linear-gradient(90deg, var(--edge-line) 0%, var(--edge-strong) 50%, var(--edge-line) 100%)",
      sidebarBg: "linear-gradient(180deg, #FAF3E8 0%, #FFFCF7 100%)",
      pageBg: "#FBF7F0",
      cardBg: "#FFFFFF",
      cardBorder: "var(--base)",
      text: "#2C1810",
      textMuted: "#7A6A5C",
      primary: "#8B1E1E",
      accent: "#D4A017",
      accentLight: "#FFF7E0",
    },
  };

  const t = themes[activeTheme];

  return (
    <div className="min-h-screen" style={{ background: t.pageBg }}>
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center gap-3 shadow-lg"
        style={{ background: t.headerBg, color: "#FFF" }}
      >
        <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-2xl">
          🧁
        </div>
        <div className="flex-1">
          <div className="font-serif text-xl font-semibold">
            Rozy Sweet, Snacks & Bakery
          </div>
          <div className="text-xs opacity-90">Sukhia Pokhri, Darjeeling</div>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-white/20 text-xs font-semibold">
          Rozy
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-semibold">
          Warish
        </div>
      </div>

      {/* Theme switcher */}
      <div className="p-4 flex gap-2 flex-wrap justify-center" style={{ background: "#FFFFFF90" }}>
        {["A", "B", "C"].map((k) => (
          <button
            key={k}
            onClick={() => setActiveTheme(k)}
            className="px-5 py-3 rounded-xl font-semibold text-sm transition"
            style={{
              background: activeTheme === k ? t.primary : "#FFF",
              color: activeTheme === k ? "#FFF" : "#3A2410",
              border: `2px solid ${activeTheme === k ? t.primary : "var(--base)"}`,
              boxShadow: activeTheme === k ? "0 4px 16px rgba(139,30,30,0.25)" : "none",
            }}
          >
            <div className="font-bold">{k} — {themes[k].name}</div>
            <div className="text-[10px] opacity-75 mt-0.5">{themes[k].desc}</div>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="p-6 flex gap-4 max-w-7xl mx-auto">
        {/* Sidebar preview */}
        <div
          className="w-64 rounded-2xl p-4 shadow-lg flex-shrink-0"
          style={{ background: t.sidebarBg }}
        >
          <div className="text-xs font-bold uppercase mb-3 opacity-70"
               style={{ color: t.text }}>
            MENU
          </div>
          {["Billing", "Dashboard", "Products", "Inventory", "Orders", "Settings"].map(
            (item, i) => (
              <div
                key={item}
                className="px-3 py-2.5 rounded-xl mb-1 font-medium text-sm transition"
                style={{
                  background: i === 0 ? t.primary : "transparent",
                  color: i === 0 ? "#FFF" : t.text,
                }}
              >
                {item}
              </div>
            )
          )}

          <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                   style={{ background: t.accentLight, color: t.accent }}>
                O
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: t.text }}>
                  Owner
                </div>
                <div className="text-xs" style={{ color: t.textMuted }}>
                  Admin
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 space-y-4">
          {/* Stats cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Today", value: "₹11,950" },
              { label: "Bills", value: "47" },
              { label: "Avg Bill", value: "₹254" },
              { label: "Low Stock", value: "3" },
            ].map((s) => (
              <div
                key={s.label}
                className="p-4 rounded-2xl shadow-md"
                style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}` }}
              >
                <div className="text-[10px] uppercase tracking-wider font-semibold"
                     style={{ color: t.textMuted }}>
                  {s.label}
                </div>
                <div className="font-mono text-xl font-bold mt-1"
                     style={{ color: t.primary }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Product tiles */}
          <div>
            <div className="text-sm font-bold uppercase mb-3"
                 style={{ color: t.textMuted }}>
              Products
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { name: "Kaju Katli", price: "₹1400", unit: "kg", emoji: "🍬" },
                { name: "Laddoo", price: "₹500", unit: "kg", emoji: "🍡" },
                { name: "Brown Bread", price: "₹50", unit: "piece", emoji: "🍞" },
                { name: "Rosogolla", price: "₹20", unit: "piece", emoji: "🍮" },
              ].map((p) => (
                <div
                  key={p.name}
                  className="rounded-2xl p-3 shadow-md transition hover:shadow-xl cursor-pointer"
                  style={{
                    background: t.cardBg,
                    border: `2px solid ${t.cardBorder}`,
                  }}
                >
                  <div
                    className="aspect-square rounded-xl mb-2 flex items-center justify-center text-4xl"
                    style={{ background: t.accentLight }}
                  >
                    {p.emoji}
                  </div>
                  <div className="font-semibold text-sm" style={{ color: t.text }}>
                    {p.name}
                  </div>
                  <div className="flex justify-between items-baseline mt-1">
                    <div className="font-mono font-bold" style={{ color: t.primary }}>
                      {p.price}
                    </div>
                    <div className="text-xs" style={{ color: t.textMuted }}>
                      /{p.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              className="px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-lg"
              style={{ background: t.primary }}
            >
              💳 CHECKOUT ₹550
            </button>
            <button
              className="px-6 py-3 rounded-xl font-semibold text-sm shadow-md"
              style={{
                background: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                color: t.text,
              }}
            >
              Hold Bill
            </button>
            <button
              className="px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-lg"
              style={{ background: t.accent }}
            >
              ⚡ Quick Sale
            </button>
          </div>

          {/* Info card */}
          <div
            className="p-5 rounded-2xl shadow-md"
            style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}` }}
          >
            <div className="font-semibold mb-2" style={{ color: t.text }}>
              Today's Summary
            </div>
            <div className="text-sm space-y-1" style={{ color: t.textMuted }}>
              <div className="flex justify-between">
                <span>Cash</span>
                <span className="font-mono" style={{ color: t.text }}>₹8,500</span>
              </div>
              <div className="flex justify-between">
                <span>UPI</span>
                <span className="font-mono" style={{ color: t.text }}>₹2,200</span>
              </div>
              <div className="flex justify-between">
                <span>Card</span>
                <span className="font-mono" style={{ color: t.text }}>₹1,250</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer band for theme C */}
      {activeTheme === "C" && (
        <div className="h-4 mt-6" style={{ background: t.headerBg }} />
      )}

      {/* Choose button */}
      <div className="py-8 text-center" style={{ background: t.pageBg }}>
        <div className="text-lg font-semibold mb-3" style={{ color: t.text }}>
          You're viewing: <span style={{ color: t.primary }}>{t.name}</span>
        </div>
        <div className="text-sm" style={{ color: t.textMuted }}>
          Click A, B, or C above to compare. When ready, tell me in chat which one to apply.
        </div>
      </div>
    </div>
  );
}