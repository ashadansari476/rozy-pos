/** Require a returned cloud row for every upserted ID before acknowledging local queue writes. */
export function verifyCloudUpsertResponse(sent, received) {
  if (!Array.isArray(sent) || sent.length === 0) throw new Error("Cloud upsert requires records");
  if (!Array.isArray(received)) throw new Error("Cloud upsert returned no verifiable rows");
  const ids = new Set(received.map((row) => String(row?.id)));
  if (received.length !== sent.length || sent.some((row) => row?.id == null || !ids.has(String(row.id)))) {
    throw new Error("Cloud upsert acknowledgement did not match requested record IDs");
  }
  return true;
}
