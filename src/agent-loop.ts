import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { FailureMode } from './types.js';

/**
 * ============================================================================
 * EXERCISE - implement runCustomerLookupAgent below.
 * See EXERCISE.md, Task 5.
 * ============================================================================
 *
 * One record of what the agent decided to do at a single step, appended to
 * the returned trace in order. The test suite inspects this trace, so use
 * exactly these `type` values.
 */
export type AgentAction =
  | { type: 'retry'; attempt: number; delayMs: number }
  | { type: 'fix_input'; note: string }
  | { type: 'escalate'; note: string }
  | { type: 'request_credentials'; note: string }
  | { type: 'success'; resultCount: number }
  | { type: 'give_up'; reason: string };

export interface AgentLoopDeps {
  /** Calls the customer_lookup tool, mirroring its real signature. */
  callTool: (customerId: string, failureMode: FailureMode) => Promise<CallToolResult>;
  /** Injectable sleep so tests can observe backoff delays without waiting. */
  sleep?: (ms: number) => Promise<void>;
  /** Max attempts for transient errors. Defaults to 3. */
  maxRetries?: number;
}

/**
 * Drives a single customer_lookup call to completion, reacting to the
 * structured error metadata (errorCategory / isRetryable / description) the
 * tool returns:
 *
 *   - transient   -> retry, up to `maxRetries` attempts, with backoff between
 *                     attempts (call `deps.sleep` with an increasing delay
 *                     before each retry). If still failing after the last
 *                     attempt, record a 'give_up' action.
 *   - validation  -> do NOT blindly retry the same input. Record a
 *                     'fix_input' action and stop.
 *   - business    -> never retry. Record an 'escalate' action and stop.
 *   - permission  -> never retry. Record a 'request_credentials' action and
 *                     stop.
 *   - success (isError: false) -> record a 'success' action with the
 *                     resultCount from the response (0 for a valid empty
 *                     result) and stop.
 *
 * Returns the full ordered trace of actions taken.
 *
 * `failureMode` lets the caller/tests force a scenario, exactly like the
 * customer_lookup tool's own `failure_mode` parameter - in a real run against
 * a live backend you'd normally call `deps.callTool(customerId, 'none')`.
 */
function parsePayload(result: CallToolResult): any {
  const block = result.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Expected a text content block');
  }
  return JSON.parse(block.text);
}

export async function runCustomerLookupAgent(
  customerId: string,
  failureMode: FailureMode,
  deps: AgentLoopDeps,
): Promise<AgentAction[]> {
  const result = await deps.callTool(customerId, failureMode);

  if (!result.isError) {
    const parsed = parsePayload(result);
    return [{ type: 'success', resultCount: parsed.resultCount }];
  }

  if (result.isError) {
    const parsedError = parsePayload(result);
    const { errorCategory, isRetryable, description } = parsedError;

    if (errorCategory === 'transient' && isRetryable) {
      const actions: AgentAction[] = [];
      let attempt = 1;
      const maxRetries = deps.maxRetries ?? 3;

      while (attempt < maxRetries) {
        actions.push({ type: 'retry', attempt, delayMs: attempt * 1000 });
        if (deps.sleep) {
          await deps.sleep(attempt * 1000);
        }
        const retryResult = await deps.callTool(customerId, failureMode);
        if (!retryResult.isError) {
          const parsedRetry = parsePayload(retryResult);
          actions.push({ type: 'success', resultCount: parsedRetry.resultCount });
          return actions;
        }
        attempt++;
      }
      actions.push({ type: 'give_up', reason: 'Max retries reached for transient error.' });
      return actions;
    }
    if (errorCategory === 'validation') {
      return [{ type: 'fix_input', note: description }];
    }
    if (errorCategory === 'business') {
      return [{ type: 'escalate', note: description }];
    }
    if (errorCategory === 'permission') {
      return [{ type: 'request_credentials', note: description }];
    }
    throw new Error(`Unknown errorCategory: ${errorCategory}`);
  }

  throw new Error('Unreachable: result must be either an error or a success');
}
