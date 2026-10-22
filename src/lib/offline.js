// ============================================================
// Offline Utilities
// ============================================================
import { db } from "./db";
import { authHeaders } from "./supabaseAuth";

// ---------- Detect online/offline ----------
export function isOnline() {
  return typeof navigator !== "undefined" && navigator.onLine;
}

// ---------- Check if sync is configured ----------
export function hasSyncConfig() {
  return !!(
    localStorage.getItem("rozy-pos-supabase-url") &&
    localStorage.getItem("rozy-pos-supabase-key")
  );
}

// ---------- Get pending queue count ----------
export async function getPendingCount() {
  try {
    const all = await db.syncQueue.toArray();
    // Only count items under retry limit
    return all.filter((op) => (op.retries || 0) < 5).length;
  } catch (e) {
    return 0;
  }
}

// ---------- Queue status info ----------
export async function getQueueStatus() {
  const all = await db.syncQueue.toArray().catch(() => []);
  const pending = all.filter(
    (op) => (op.status === "pending" || !op.status) && (op.retries || 0) < 5
  ).length;
  const failed = all.filter((op) => op.status === "failed").length;
  const done = all.filter((op) => op.status === "done").length;
  return { pending, failed, done };
}

// ---------- Connection quality probe ----------
export async function probeConnection() {
  if (!isOnline()) return { online: false, quality: "none" };

  const url = localStorage.getItem("rozy-pos-supabase-url");
  if (!url) return { online: true, quality: "unknown" };

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const key = localStorage.getItem("rozy-pos-supabase-key");
    const res = await fetch(`${url}/rest/v1/products?select=id&limit=1`, {
      headers: await authHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latency = Date.now() - start;

    if (res.ok) {
      return {
        online: true,
        quality: latency < 500 ? "excellent" : latency < 1500 ? "good" : "slow",
        latency,
      };
    }
    return { online: true, quality: "unstable", latency };
  } catch (e) {
    return { online: true, quality: "unreachable", error: e.message };
  }
}

// ---------- Get a friendly label for connectivity ----------
export function getConnectionLabel(probe) {
  if (!probe.online) return { text: "Offline", color: "red" };
  if (probe.quality === "excellent") return { text: "Online", color: "green" };
  if (probe.quality === "good") return { text: "Online", color: "green" };
  if (probe.quality === "slow") return { text: "Slow connection", color: "amber" };
  if (probe.quality === "unstable") return { text: "Unstable", color: "amber" };
  if (probe.quality === "unreachable") return { text: "Server unreachable", color: "red" };
  return { text: "Online", color: "green" };
}