export const RETRY_LIMIT = 5;
export const RETRY_BASE_MS = 15000;
export const RETRY_MAX_MS = 3600000;
export function nextQueueFailure(op, error, now = Date.now()) {
 const retries = Math.max(0, Number(op?.retries) || 0) + 1;
 return { retries, status: retries >= RETRY_LIMIT ? "failed" : "pending", lastError: String(error?.message || error || "Unknown sync error").slice(0,500), lastAttemptAt: now, nextRetryAt: now + Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.min(retries-1,12)) };
}
export function shouldAttemptQueueOperation(op, now = Date.now()) { return op?.status === "pending" && (!Number.isFinite(op.nextRetryAt) || op.nextRetryAt <= now); }
export function retryFailedQueueOperation(op) { if(op?.status !== "failed") throw Error("Only failed sync operations can be retried"); return {status:"pending",retries:0,nextRetryAt:0,lastError:null}; }

/**
 * Preserve per-record order. A failed or deferred older operation must block
 * subsequent changes to that same record until the older operation is resolved.
 */
export function selectReadyQueueOperations(operations, now = Date.now()) {
  const ordered = [...operations].sort((a, b) =>
    (a.createdAt || 0) - (b.createdAt || 0) || (a.id || 0) - (b.id || 0));
  const seen = new Set();
  const ready = [];
  for (const op of ordered) {
    const key = JSON.stringify([op.table, op.recordId]);
    if (seen.has(key)) continue;
    seen.add(key);
    if (shouldAttemptQueueOperation(op, now)) ready.push(op);
  }
  return ready;
}
