// Detects if the page was refreshed (vs first visit or dev HMR)
export function wasPageRefreshed() {
  if (typeof window === "undefined") return false;

  const navEntry = performance.getEntriesByType("navigation")[0];
  if (!navEntry) return false;

  return navEntry.type === "reload";
}