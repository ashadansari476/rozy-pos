/**
 * Keep expired batches out of the "expiring soon" list. Both lists are
 * intentionally disjoint, even when the batch expires within three days.
 */
export function isExpiredBatch(batch, now = Date.now()) {
  return !!(batch && batch.active && Number.isFinite(batch.expiryDate)
    && batch.expiryDate < now && Number.isFinite(batch.qty) && batch.qty > 0);
}

export function isExpiringBatch(batch, daysAhead = 3, now = Date.now()) {
  if (!batch || !batch.active || !Number.isFinite(batch.qty) || batch.qty <= 0
    || !Number.isFinite(batch.expiryDate)) return false;
  if (!Number.isFinite(daysAhead) || daysAhead < 0) return false;
  return batch.expiryDate >= now
    && batch.expiryDate <= now + daysAhead * 24 * 60 * 60 * 1000;
}
