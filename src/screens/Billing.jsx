import { useEffect, useState, useMemo, useRef } from "react";
import { useApp } from "../stores/appStore";
import { useCart } from "../stores/cartStore";
import { useProducts } from "../stores/productStore";
import { useTranslation } from "react-i18next";
import { saveSale, getTodayStats } from "../lib/billing";
import ProductGrid from "../components/billing/ProductGrid";
import CartPanel from "../components/billing/CartPanel";
import WeightModal from "../components/billing/WeightModal";
import PaymentModal from "../components/billing/PaymentModal";
import ReceiptModal from "../components/billing/ReceiptModal";
import { Search, PauseCircle, PlayCircle, TrendingUp, X } from "lucide-react";
import { useShop } from "../stores/shopStore";
import { showToast } from "../components/ui/Toast";
import { db } from "../lib/db";
import SearchInput from "../components/ui/SearchInput";

const HELD_KEY = "rozy-pos-held-bills";

export default function Billing() {
  const { t } = useTranslation();
  const counter = useApp((s) => s.counter);
  const user = useApp((s) => s.user);
  const cart = useCart();
  const { currentShopId } = useShop();
  const { products, categories, load: loadProducts } = useProducts();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [weightProduct, setWeightProduct] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [heldBills, setHeldBills] = useState([]);
  const [showHeld, setShowHeld] = useState(false);
  const [stats, setStats] = useState({ total: 0, count: 0, cash: 0, upi: 0, card: 0 });
  const searchRef = useRef(null);
const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    loadProducts(currentShopId);
    refreshStats();
    setHeldBills(JSON.parse(localStorage.getItem(HELD_KEY) || "[]"));
  }, [counter, currentShopId]);

  const refreshStats = async () => {
    const s = await getTodayStats(counter);
    setStats(s);
  };

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.active !== false);
    if (activeCategory !== "All") list = list.filter((p) => p.category === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q))
      );
    }
    return list;
  }, [products, activeCategory, search]);

  const handleAdd = (product) => {
    // If product has variants, add first variant or show variant picker
    if (product.variants && product.variants.length > 0) {
      // Show variant picker as a simple prompt-based flow
      // For simplicity, use the first variant; expandable later
      const v = product.variants[0];
      cart.add(product, 1, v);
      return;
    }
    // If kg unit, show weight modal
    if (product.unit === "kg") {
      setWeightProduct(product);
      return;
    }
    // Otherwise add directly
    cart.add(product, 1);
  };

  const handleWeightConfirm = (qty) => {
    if (weightProduct) {
      cart.add(weightProduct, qty);
      setWeightProduct(null);
    }
  };

  const handleCheckout = () => {
    // Validate stock before opening payment
    const oversized = cart.items.filter(
      (it) => it.availableStock !== undefined && it.qty > it.availableStock
    );

    if (oversized.length > 0) {
      const role = user?.role;
      if (role !== "owner") {
        const list = oversized
          .map((it) => `• ${it.name}: ${it.qty} requested, ${it.availableStock} available`)
          .join("\n");
        alert(`❌ Cannot checkout — insufficient stock:\n\n${list}`);
        return;
      }
      const list = oversized
        .map((it) => `• ${it.name}: ${it.qty} requested, ${it.availableStock} available`)
        .join("\n");
      if (!confirm(`⚠️ Stock issues:\n\n${list}\n\nProceed anyway?`)) return;
    }

    setShowPayment(true);
  };

   const handlePaymentConfirm = async (payment) => {
    const items = cart.items;
    const subtotal = cart.subtotal();
    const discount = cart.discountAmount();
    const total = cart.total();

    const sale = await saveSale({
      shopId: currentShopId,
      cashier: user.username,
      items,
      subtotal,
      discount,
      total,
      payment,
    });

    setLastSale({
      billNo: sale.billNo,
      ts: sale.ts,
      items,
      subtotal,
      discount,
      total,
      payment,
      counter: counter === "Both" ? "Rozy" : counter,
      cashier: user.username,
    });

    setShowPayment(false);
    setShowReceipt(true);
    cart.clear();
    await loadProducts();
    refreshStats();

    // Low stock alert
    checkLowStockAfterSale(items);
  };

  const checkLowStockAfterSale = (soldItems) => {
    // Wait for products to reload, then check
    setTimeout(async () => {
      const shopId = currentShopId;
      const stocks = await db.shopStock.where("shopId").equals(shopId).toArray();
      const products = await db.products.toArray();
      const productById = {};
      for (const p of products) productById[p.id] = p;

      const lowItems = [];
      for (const stock of stocks) {
        const low = stock.lowStock || 0;
        if (stock.stock <= low && stock.stock >= 0) {
          const p = productById[stock.productId];
          if (p) {
            lowItems.push({
              name: p.name,
              stock: stock.stock,
              lowStock: low,
              unit: p.unit,
            });
          }
        }
      }

      if (lowItems.length === 0) return;

      // Show toast
      if (lowItems.length === 1) {
        const it = lowItems[0];
        const urgency = it.stock === 0 ? "❌" : "⚠️";
        showToast(
          `${urgency} Low stock: ${it.name}\n${it.stock} ${it.unit} left (min: ${it.lowStock})`,
          it.stock === 0 ? "error" : "warning",
          5000
        );
      } else {
        const lines = lowItems.slice(0, 3).map(
          (it) => `• ${it.name}: ${it.stock} ${it.unit}`
        );
        const extra = lowItems.length > 3 ? `\n+ ${lowItems.length - 3} more` : "";
        showToast(
          `⚠️ ${lowItems.length} items low on stock\n${lines.join("\n")}${extra}`,
          "warning",
          5000
        );
      }
    }, 300);
  };

  const handlePrint = (html) => {
    const w = window.open("", "_blank", "width=400,height=600");
    w.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body { font-family: 'Courier New', monospace; padding: 10px; width: 280px; margin: 0 auto; }
        @media print { body { width: auto; } @page { margin: 0; size: 58mm auto; } }
      </style></head><body>${html}</body></html>
    `);
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
  };

  const handleHold = () => {
    if (cart.items.length === 0) return;
    const name = prompt("Name / reference for this bill:", `Held ${heldBills.length + 1}`);
    if (!name) return;
    const newHeld = [
      ...heldBills,
      { id: Date.now(), name, items: cart.items, ts: Date.now() },
    ];
    localStorage.setItem(HELD_KEY, JSON.stringify(newHeld));
    setHeldBills(newHeld);
    cart.clear();
  };

  const resumeHeld = (held) => {
    if (cart.items.length > 0 && !confirm("Replace current cart?")) return;
    cart.clear();
    held.items.forEach((it) => {
      // re-add item
      cart.items.push(it);
    });
    useCart.setState({ items: held.items });
    const updated = heldBills.filter((h) => h.id !== held.id);
    localStorage.setItem(HELD_KEY, JSON.stringify(updated));
    setHeldBills(updated);
    setShowHeld(false);
  };

  const deleteHeld = (id) => {
    const updated = heldBills.filter((h) => h.id !== id);
    localStorage.setItem(HELD_KEY, JSON.stringify(updated));
    setHeldBills(updated);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "F1") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "F2" && cart.items.length > 0) { e.preventDefault(); handleCheckout(); }
      if (e.key === "F9") { e.preventDefault(); cart.clear(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart.items.length]);

  return (
        <div className="h-full flex flex-col lg:flex-row gap-3 p-2 sm:p-3 lg:p-4 overflow-hidden pb-20 lg:pb-4">
      {/* Left: products */}
      <div className="flex-1 flex flex-col gap-3 min-h-0">
                {/* Stats bar */}
        <div className="flex gap-2 flex-wrap">
          <div className="card px-3 py-2 flex items-center gap-2">
            <TrendingUp size={14} className="text-success flex-shrink-0" />
            <div>
              <div className="text-[10px] text-ink-muted uppercase">Today</div>
              <div className="font-mono font-bold text-xs lg:text-sm text-primary">
                ₹{stats.total.toFixed(0)} · {stats.count}
              </div>
            </div>
          </div>
          <div className="card px-3 py-2 hidden md:flex items-center gap-2">
            <div className="text-[10px] text-ink-muted uppercase">
              Cash / UPI / Card
            </div>
            <div className="font-mono font-bold text-xs lg:text-sm text-ink">
              ₹{stats.cash.toFixed(0)} / ₹{stats.upi.toFixed(0)} / ₹{stats.card.toFixed(0)}
            </div>
          </div>
          {heldBills.length > 0 && (
            <button
              onClick={() => setShowHeld(true)}
              className="card px-3 py-2 flex items-center gap-2 hover:border-primary transition"
            >
              <PauseCircle size={14} className="text-warning flex-shrink-0" />
              <div className="font-semibold text-xs lg:text-sm">
                {heldBills.length} held
              </div>
            </button>
          )}
        </div>

        {/* Search */}
                <SearchInput
          inputRef={searchRef}
          value={search}
          onChange={setSearch}
          placeholder={`${t("search_products")} (F1)`}
        />

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 flex-shrink-0">
          <button
            onClick={() => setActiveCategory("All")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
              activeCategory === "All"
                ? "bg-primary text-white shadow-warm"
                : "bg-surface text-ink hover:bg-primary-light border border-border"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.name)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                activeCategory === c.name
                  ? "bg-primary text-white shadow-warm"
                  : "bg-surface text-ink hover:bg-primary-light border border-border"
              }`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

                {/* Product grid */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-[200px]">
          <ProductGrid products={filtered} onAdd={handleAdd} />
        </div>
      </div>

                  {/* Right: cart — desktop panel / mobile bottom sheet */}
      <>
        {/* Desktop: always visible */}
        <div className="hidden lg:block lg:w-[380px] flex-shrink-0 lg:h-full">
          <CartPanel onCheckout={handleCheckout} onHold={handleHold} />
        </div>

        {/* Mobile: bottom sheet */}
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-30">
          {/* Backdrop when open */}
          {cartOpen && (
            <div
              className="fixed inset-0 bg-black/40 z-[-1]"
              onClick={() => setCartOpen(false)}
            />
          )}

          {/* Sheet */}
          <div
            className={`bg-surface rounded-t-2xl2 shadow-warmH transition-all duration-300 ${
              cartOpen ? "h-[80vh]" : "h-16"
            }`}
            style={{
              borderTop: "2px solid #B8935A",
            }}
          >
            {/* Collapsed bar */}
            {!cartOpen && (
              <button
                onClick={() => setCartOpen(true)}
                className="w-full h-16 flex items-center justify-between px-4"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="text-2xl">🛒</span>
                    {cart.items.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px]
                                       font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {cart.items.length}
                      </span>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-sm text-primary">
                      {cart.items.length === 0
                        ? "Cart is empty"
                        : `${cart.items.length} item${cart.items.length > 1 ? "s" : ""}`}
                    </div>
                    <div className="text-xs text-ink-muted">
                      ₹{cart.total().toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cart.items.length > 0 && (
                    <span className="font-mono font-bold text-primary text-lg">
                      ₹{cart.total().toFixed(2)}
                    </span>
                  )}
                  <span className="text-xs text-ink-muted">
                    Tap to {cart.items.length === 0 ? "view" : "checkout"}
                  </span>
                </div>
              </button>
            )}

            {/* Expanded: full cart */}
            {cartOpen && (
              <div className="h-full flex flex-col relative">
                {/* Close button */}
                <button
                  onClick={() => setCartOpen(false)}
                  className="absolute top-3 right-3 z-10 p-2 rounded-full bg-bg text-ink-muted
                             hover:bg-primary-light transition"
                >
                  <X size={18} />
                </button>

                <div className="flex-1 overflow-hidden">
                  <CartPanel
                    onCheckout={() => {
                      setCartOpen(false);
                      handleCheckout();
                    }}
                    onHold={() => {
                      setCartOpen(false);
                      handleHold();
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </>

      {/* Modals */}
      <WeightModal
        open={!!weightProduct}
        onClose={() => setWeightProduct(null)}
        product={weightProduct}
        onConfirm={handleWeightConfirm}
      />

      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        total={cart.total()}
        onConfirm={handlePaymentConfirm}
      />

      <ReceiptModal
        open={showReceipt}
        onClose={() => { setShowReceipt(false); setLastSale(null); }}
        sale={lastSale}
        onPrint={handlePrint}
      />

      {/* Held bills modal */}
      {showHeld && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowHeld(false)}>
          <div className="bg-surface rounded-xl2 p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-xl text-primary font-semibold mb-4">
              ⏸ Held Bills
            </h2>
            {heldBills.length === 0 ? (
              <p className="text-ink-muted text-sm text-center py-4">No held bills</p>
            ) : (
              <div className="space-y-2">
                {heldBills.map((h) => {
                  const total = h.items.reduce((s, i) => s + i.qty * i.price, 0);
                  return (
                    <div key={h.id} className="bg-bg rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{h.name}</div>
                        <div className="text-xs text-ink-muted">
                          {h.items.length} items · ₹{total.toFixed(2)}
                        </div>
                      </div>
                      <button onClick={() => resumeHeld(h)} className="btn-primary py-1.5 px-3 text-xs">
                        <PlayCircle size={14} /> Resume
                      </button>
                      <button onClick={() => deleteHeld(h.id)} className="btn-outline py-1.5 px-3 text-xs">
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => setShowHeld(false)} className="btn-outline w-full mt-4">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}