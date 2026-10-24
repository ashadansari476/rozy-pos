import test from "node:test";
import assert from "node:assert/strict";
import { nextQueueFailure, shouldAttemptQueueOperation, retryFailedQueueOperation } from "./src/lib/syncQueueRules.js";
test("backoff",()=>{const x=nextQueueFailure({retries:0},Error("offline"),1000);assert.equal(x.nextRetryAt,16000);assert.equal(shouldAttemptQueueOperation(x,1001),false);assert.equal(shouldAttemptQueueOperation(x,16000),true);});
test("failed records remain",()=>{const op={retries:4,data:{total:500}};assert.equal(nextQueueFailure(op,"error",1000).status,"failed");assert.equal(op.data.total,500);});
test("manual retry",()=>{assert.deepEqual(retryFailedQueueOperation({status:"failed"}),{status:"pending",retries:0,nextRetryAt:0,lastError:null});assert.throws(()=>retryFailedQueueOperation({status:"pending"}),/Only failed/);});
test("bounds",()=>{const x=nextQueueFailure({retries:100},"x".repeat(900),1000);assert.equal(x.nextRetryAt,3601000);assert.equal(x.lastError.length,500);});
test("legacy",()=>{assert.equal(shouldAttemptQueueOperation({status:"pending"},123),true);assert.equal(shouldAttemptQueueOperation({status:"failed"},123),false);});

import { selectReadyQueueOperations } from "./src/lib/syncQueueRules.js";

test("deferred older update blocks later delete on same record", () => {
  const ops = [
    { id: 1, table: "sales", recordId: 42, status: "pending", nextRetryAt: 2000 },
    { id: 2, table: "sales", recordId: 42, status: "pending", action: "delete" },
    { id: 3, table: "sales", recordId: 43, status: "pending" },
  ];
  assert.deepEqual(selectReadyQueueOperations(ops, 1000).map((x) => x.id), [3]);
});

test("failed older operation blocks newer upsert until manual retry", () => {
  const ops = [
    { id: 1, table: "products", recordId: 5, status: "failed" },
    { id: 2, table: "products", recordId: 5, status: "pending" },
  ];
  assert.deepEqual(selectReadyQueueOperations(ops, 1000), []);
});

test("same record id in different tables is independent", () => {
  const ops = [
    { id: 1, table: "sales", recordId: 5, status: "pending" },
    { id: 2, table: "payments", recordId: 5, status: "pending" },
  ];
  assert.equal(selectReadyQueueOperations(ops, 1000).length, 2);
});

test("only oldest pending operation for each record is sent per pass", () => {
  const ops = [
    { id: 2, table: "sales", recordId: 5, status: "pending", createdAt: 200 },
    { id: 1, table: "sales", recordId: 5, status: "pending", createdAt: 100 },
  ];
  assert.deepEqual(selectReadyQueueOperations(ops, 1000).map((x) => x.id), [1]);
});
