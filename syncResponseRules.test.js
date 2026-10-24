import test from "node:test";
import assert from "node:assert/strict";
import { verifyCloudUpsertResponse } from "./src/lib/syncResponseRules.js";

test("cloud acknowledges all requested record IDs", () => {
  assert.equal(verifyCloudUpsertResponse([{ id: 5 }, { id: 6 }], [{ id: 6 }, { id: 5 }]), true);
});
test("empty or malformed cloud response does not acknowledge sale", () => {
  for (const value of [null, undefined, [], {}, "ok"]) {
    assert.throws(() => verifyCloudUpsertResponse([{ id: 5 }], value));
  }
});
test("different IDs or partial acknowledgement cannot drain queue", () => {
  assert.throws(() => verifyCloudUpsertResponse([{ id: 5 }], [{ id: 6 }]));
  assert.throws(() => verifyCloudUpsertResponse([{ id: 5 }, { id: 6 }], [{ id: 5 }]));
});
