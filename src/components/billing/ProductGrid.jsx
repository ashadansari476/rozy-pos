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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
      {products.map((p) => {
        const low = (p.stock || 0) <= (p.lowStock || 0);
        const imageUrl = p.imageUrl || p.imageDataUrl;
        return (
          <button
            key={p.id}
            onClick={() => onAdd(p)}
            className="product-tile p-2 sm:p-3 text-left active:scale-[0.97] transition"
          >
            {/* Image */}
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

            {/* Name — truncate to 2 lines max */}
            <div
              className="font-semibold text-xs sm:text-sm leading-tight line-clamp-2"
              style={{
                color: "#3A2410",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: "2.4em",
              }}
            >
              {p.name}
            </div>

            {/* Price + Unit */}
            <div className="flex items-baseline justify-between mt-1.5">
              <div className="font-mono font-bold text-sm" style={{ color: "#8B1E1E" }}>
                ₹{p.price}
              </div>
              <div className="text-[10px] sm:text-xs" style={{ color: "#6B4423" }}>
                /{p.unit}
              </div>
            </div>

            {/* Low stock warning */}
            {low && (
              <div
                className="flex items-center gap-1 text-[10px] mt-1"
                style={{ color: "#E67E22" }}
              >
                <AlertTriangle size={10} />
                <span>
                  {p.stock} {p.unit}
                </span>
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