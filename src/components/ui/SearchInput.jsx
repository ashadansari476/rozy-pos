import { Search, X } from "lucide-react";

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  onClear,
  autoFocus = false,
  inputRef = null,
  className = "",
}) {
  const handleClear = () => {
    if (onClear) onClear();
    else onChange("");
  };

  return (
    <div className={`relative ${className}`}>
      {/* Icon — absolutely positioned but with high z-index and pointer-events-none */}
            <Search
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10"
        style={{ color: "var(--edge-strong)" }}
      />
      {/* Input with proper left padding for the icon */}
            <input
        ref={inputRef}
        type="text"
        className="w-full pl-12 pr-10 py-3 rounded-xl text-ink placeholder:text-ink-faint
                   transition-all text-sm focus:outline-none"
        style={{
          background: "var(--surface-input)",
          border: "2px solid var(--edge-soft)",
          boxShadow: "inset 0 1px 3px rgba(107, 68, 35, 0.08)",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--edge-strong)";
          e.target.style.background = "#FFFFFF";
          e.target.style.boxShadow = "0 0 0 3px rgba(139, 90, 43, 0.15)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "var(--edge-soft)";
          e.target.style.background = "var(--surface-input)";
          e.target.style.boxShadow = "inset 0 1px 3px rgba(107, 68, 35, 0.08)";
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />

      {/* Clear button — only shows when there's text */}
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10
                     p-1 rounded-full text-ink-muted hover:text-ink hover:bg-bg/45 transition"
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}