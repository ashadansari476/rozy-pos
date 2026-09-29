import { AlertTriangle } from "lucide-react";

export default function ProductGrid({ products, onAdd }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-20 text-ink-muted">
        No products found. Add products first in the Products screen.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {products.map((p) => {
        const low = (p.stock || 0) <= (p.lowStock || 0);
        const imageUrl = p.imageUrl || p.imageDataUrl;
        return (
          <button
            key={p.id}
            onClick={() => onAdd(p)}
            className="product-tile p-3 text-left active:scale-[0.97]"
          >
            <div
              className="aspect-square rounded-xl mb-2 flex items-center
                          justify-center text-3xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #FFF2CC 0%, #FFE8B0 100%)",
                boxShadow: "inset 0 2px 6px rgba(107, 68, 35, 0.08)",
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                getCategoryIcon(p.category)
              )}
            </div>
            <div
              className="font-semibold text-sm truncate"
              style={{ color: "#3A2410" }}
            >
              {p.name}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <div className="font-mono font-bold" style={{ color: "#8B1E1E" }}>
                ₹{p.price}
              </div>
              <div className="text-xs" style={{ color: "#6B4423" }}>
                /{p.unit}
              </div>
            </div>
            {low && (
              <div className="flex items-center gap-1 text-xs mt-1" style={{ color: "#E67E22" }}>
                <AlertTriangle size={10} />
                <span>Low: {p.stock} {p.unit}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function getCategoryIcon(cat) {
  const map = {
    Bakery: "🥖",
    Sweets: "🍬",
    Snacks: "🥨",
    Beverages: "☕",
  };
  return map[cat] || "📦";
}