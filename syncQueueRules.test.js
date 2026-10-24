import test from "node:test";
import assert from "node:assert/strict";
import { nextQueueFailure, shouldAttemptQueueOperation, retryFailedQueueOperation } from "./src/lib/syncQueueRules.js";
test("backoff",()=>{const x=nextQueueFailure({retries:0},Error("offline"),1000);assert.equal(x.nextRetryAt,16000);assert.equal(shouldAttemptQueueOperation(x,1001),false);assert.equal(shouldAttemptQueueOperation(x,16000),true);});
test("failed records remain",()=>{const op={retries:4,data:{total:500}};assert.equal(nextQueueFailure(op,"error",1000).status,"failed");assert.equal(op.data.total,500);});
test("manual retry",()=>{assert.deepEqual(retryFailedQueueOperation({status:"failed"}),{status:"pending",retries:0,nextRetryAt:0,lastError:null});assert.throws(()=>retryFailedQueueOperation({status:"pending"}),/Only failed/);});
test("bounds",()=>{const x=nextQueueFailure({retries:100},"x".repeat(900),1000);assert.equal(x.nextRetryAt,3601000);assert.equal(x.lastError.length,500);});
test("legacy",()=>{assert.equal(shouldAttemptQueueOperation({status:"pending"},123),true);assert.equal(shouldAttemptQueueOperation({status:"failed"},123),false);});
