import { parseSyncTimestamp } from "./syncTimestampRules.js";

/** Local pull policy; this alone does not make server writes conflict-safe. */
export function shouldApplyRemoteRecord(local, remote) {
  const localTs = parseSyncTimestamp(local?.updatedAt ?? local?.createdAt);
  const remoteTs = parseSyncTimestamp(remote?.updatedAt ?? remote?.createdAt);
  return remoteTs !== null && (localTs === null || remoteTs > localTs);
}
