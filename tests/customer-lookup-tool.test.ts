import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerLookupHandler } from '../src/customer-lookup-tool.js';
import type { ErrorCategory } from '../src/types.js';

function textOf(result: Awaited<ReturnType<typeof customerLookupHandler>>): string {
  const block = result.content[0];
  assert.ok(block && block.type === 'text', 'content[0] must be a text block');
  return (block as { type: 'text'; text: string }).text;
}

function parseJson(result: Awaited<ReturnType<typeof customerLookupHandler>>): unknown {
  const text = textOf(result);
  assert.doesNotThrow(() => JSON.parse(text), 'content[0].text must be valid JSON');
  return JSON.parse(text);
}

async function assertStructuredError(
  failureMode: 'timeout' | 'invalid_format' | 'policy_violation' | 'access_denied',
  expectedCategory: ErrorCategory,
  expectedRetryable: boolean,
) {
  const result = await customerLookupHandler({ customer_id: 'CUST-1001', failure_mode: failureMode });

  assert.equal(result.isError, true, `failure_mode "${failureMode}" must set isError: true`);

  const payload = parseJson(result) as Record<string, unknown>;
  assert.deepEqual(
    Object.keys(payload).sort(),
    ['description', 'errorCategory', 'isRetryable'],
    `error payload for "${failureMode}" must have exactly errorCategory, isRetryable, description`,
  );
  assert.equal(payload.errorCategory, expectedCategory);
  assert.equal(payload.isRetryable, expectedRetryable);
  assert.equal(typeof payload.description, 'string');
  assert.ok((payload.description as string).length > 0, 'description must be non-empty');
}

test('failure_mode "timeout" -> transient error, isRetryable true', async () => {
  await assertStructuredError('timeout', 'transient', true);
});

test('failure_mode "invalid_format" -> validation error, isRetryable true', async () => {
  await assertStructuredError('invalid_format', 'validation', true);
});

test('failure_mode "policy_violation" -> business error, isRetryable false', async () => {
  await assertStructuredError('policy_violation', 'business', false);
});

test('failure_mode "access_denied" -> permission error, isRetryable false', async () => {
  await assertStructuredError('access_denied', 'permission', false);
});

test('known customer, no failure_mode -> successful lookup with data', async () => {
  const result = await customerLookupHandler({ customer_id: 'CUST-1001', failure_mode: 'none' });

  assert.equal(result.isError, false, 'a successful lookup must not be isError');
  const payload = parseJson(result) as Record<string, unknown>;
  assert.equal(payload.resultCount, 1);
  assert.ok('customer' in payload, 'payload must include the found customer record');
  assert.equal((payload.customer as { id: string }).id, 'CUST-1001');
});

test('unknown customer, no failure_mode -> valid empty result, NOT an error', async () => {
  const result = await customerLookupHandler({ customer_id: 'CUST-9999', failure_mode: 'none' });

  assert.equal(result.isError, false, 'a query that finds nothing is still a successful query');
  const payload = parseJson(result) as Record<string, unknown>;
  assert.equal(payload.resultCount, 0);
  assert.equal('errorCategory' in payload, false, 'a valid empty result must not carry error metadata');
});

test('failure_mode defaults to "none" when omitted', async () => {
  const result = await customerLookupHandler({ customer_id: 'CUST-1002' });
  assert.equal(result.isError, false);
});
