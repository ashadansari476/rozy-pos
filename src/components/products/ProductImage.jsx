// Small reusable component to show product image or fallback emoji
export default function ProductImage({ product, size = "md", className = "" }) {
  const sizes = {
    sm: "w-8 h-8 text-lg",
    md: "w-10 h-10 text-xl",
    lg: "w-16 h-16 text-2xl",
    xl: "w-full aspect-square text-4xl",
  };

  const emoji = getCategoryIcon(product.category);

  if (product.imageUrl || product.imageDataUrl) {
    return (
      <img
        src={product.imageUrl || product.imageDataUrl}
        alt={product.name}
        className={`${sizes[size]} object-cover rounded-xl ${className}`}
        onError={(e) => {
          // Fallback to emoji if image fails to load
          e.target.style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} rounded-xl bg-bg flex items-center justify-center ${className}`}
    >
      {emoji}
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