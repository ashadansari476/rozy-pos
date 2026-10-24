import test from "node:test";
import assert from "node:assert/strict";
import { parseSyncTimestamp } from "./src/lib/syncTimestampRules.js";

test("ISO and numeric milliseconds represent the same instant", () => {
  const ms = Date.parse("2026-10-24T00:00:00.000Z");
  assert.equal(parseSyncTimestamp(ms), parseSyncTimestamp("2026-10-24T00:00:00.000Z"));
});
test("numeric seconds strings are converted to milliseconds", () => {
  assert.equal(parseSyncTimestamp("1700000000"), 1700000000000);
});
test("unknown timestamps do not silently compare as zero", () => {
  for (const value of [null, undefined, "", "invalid", NaN, 0]) {
    assert.equal(parseSyncTimestamp(value), null);
  }
});
