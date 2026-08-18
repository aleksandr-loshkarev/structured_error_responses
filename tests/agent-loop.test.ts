import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCustomerLookupAgent, type AgentAction } from '../src/agent-loop.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ErrorCategory } from '../src/types.js';

function errorResult(errorCategory: ErrorCategory, isRetryable: boolean): CallToolResult {
  return {
    isError: true,
    content: [
      { type: 'text', text: JSON.stringify({ errorCategory, isRetryable, description: `${errorCategory} failure` }) },
    ],
  };
}

function successResult(resultCount: number): CallToolResult {
  return {
    isError: false,
    content: [{ type: 'text', text: JSON.stringify({ resultCount }) }],
  };
}

function fakeSleep() {
  const delays: number[] = [];
  const sleep = async (ms: number) => {
    delays.push(ms);
  };
  return { sleep, delays };
}

function lastAction(trace: AgentAction[]): AgentAction {
  assert.ok(trace.length > 0, 'agent must record at least one action');
  return trace[trace.length - 1];
}

test('transient error that resolves on the 3rd attempt: retries then succeeds', async () => {
  const { sleep, delays } = fakeSleep();
  let calls = 0;
  const callTool = async () => {
    calls += 1;
    return calls < 3 ? errorResult('transient', true) : successResult(1);
  };

  const trace = await runCustomerLookupAgent('CUST-1001', 'timeout', { callTool, sleep });

  assert.equal(calls, 3, 'should call the tool 3 times total (2 failures + 1 success)');
  const retries = trace.filter((a) => a.type === 'retry');
  assert.equal(retries.length, 2, 'should record exactly 2 retry actions');
  assert.equal(lastAction(trace).type, 'success');
  assert.equal(delays.length, 2, 'should sleep once before each retry');
});

test('transient error that never resolves: gives up after maxRetries', async () => {
  const { sleep, delays } = fakeSleep();
  let calls = 0;
  const callTool = async () => {
    calls += 1;
    return errorResult('transient', true);
  };

  const trace = await runCustomerLookupAgent('CUST-1001', 'timeout', { callTool, sleep, maxRetries: 3 });

  assert.equal(calls, 3, 'should stop after maxRetries attempts');
  assert.equal(lastAction(trace).type, 'give_up');
  assert.equal(delays.length, 2, 'should sleep between attempts, but not after the final one');
  for (let i = 1; i < delays.length; i += 1) {
    assert.ok(delays[i] >= delays[i - 1], 'backoff delays should not decrease between retries');
  }
});

test('validation error: fixes input instead of blindly retrying', async () => {
  let calls = 0;
  const callTool = async () => {
    calls += 1;
    return errorResult('validation', true);
  };

  const trace = await runCustomerLookupAgent('bad id', 'invalid_format', { callTool });

  assert.equal(calls, 1, 'must not retry a validation error with the same input');
  assert.equal(lastAction(trace).type, 'fix_input');
});

test('business error: escalates and never retries', async () => {
  let calls = 0;
  const callTool = async () => {
    calls += 1;
    return errorResult('business', false);
  };

  const trace = await runCustomerLookupAgent('CUST-1001', 'policy_violation', { callTool });

  assert.equal(calls, 1, 'business errors must never be retried');
  assert.equal(lastAction(trace).type, 'escalate');
});

test('permission error: requests credentials and never retries', async () => {
  let calls = 0;
  const callTool = async () => {
    calls += 1;
    return errorResult('permission', false);
  };

  const trace = await runCustomerLookupAgent('CUST-1001', 'access_denied', { callTool });

  assert.equal(calls, 1, 'permission errors must never be retried');
  assert.equal(lastAction(trace).type, 'request_credentials');
});

test('valid empty result is treated as success, not an error to recover from', async () => {
  const callTool = async () => successResult(0);

  const trace = await runCustomerLookupAgent('CUST-9999', 'none', { callTool });

  const success = lastAction(trace);
  assert.equal(success.type, 'success');
  assert.equal((success as { type: 'success'; resultCount: number }).resultCount, 0);
});
