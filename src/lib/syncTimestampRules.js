/** Convert both numeric epoch-milliseconds and ISO timestamps to comparable ms. */
export function parseSyncTimestamp(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{10,13}$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? (trimmed.length === 10 ? n * 1000 : n) : null;
  }
  const n = Date.parse(trimmed);
  return Number.isFinite(n) ? n : null;
}
