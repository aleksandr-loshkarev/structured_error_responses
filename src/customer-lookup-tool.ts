import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { findCustomerById } from './customer-db.js';
import type { FailureMode } from './types.js';

/**
 * ============================================================================
 * EXERCISE - implement customerLookupHandler below.
 * See EXERCISE.md, Tasks 1-4.
 * ============================================================================
 *
 * customerLookupHandler(args) must return an MCP CallToolResult shaped like
 * this, depending on `args.failure_mode`:
 *
 *   failure_mode === 'timeout'
 *     -> isError: true, content[0].text is JSON for a TRANSIENT error
 *        { errorCategory: 'transient', isRetryable: true, description: string }
 *
 *   failure_mode === 'invalid_format'
 *     -> isError: true, content[0].text is JSON for a VALIDATION error
 *        { errorCategory: 'validation', isRetryable: true, description: string }
 *
 *   failure_mode === 'policy_violation'
 *     -> isError: true, content[0].text is JSON for a BUSINESS error
 *        { errorCategory: 'business', isRetryable: false, description: string }
 *
 *   failure_mode === 'access_denied'
 *     -> isError: true, content[0].text is JSON for a PERMISSION error
 *        { errorCategory: 'permission', isRetryable: false, description: string }
 *
 *   failure_mode === 'none' (or omitted)
 *     -> look the customer up via findCustomerById(args.customer_id)
 *     -> if found:      isError: false, content[0].text is JSON like
 *                        { resultCount: 1, customer: { ...CustomerRecord } }
 *     -> if not found:  isError: false, content[0].text is JSON like
 *                        { resultCount: 0 }
 *        (a VALID EMPTY RESULT - this is NOT the same thing as an error!
 *         isError must be false here, distinct from every branch above.)
 *
 * In every branch, content[0].text must be a JSON *string* (use
 * JSON.stringify), and the error branches must contain EXACTLY the three
 * fields errorCategory / isRetryable / description - nothing more.
 */
export async function customerLookupHandler(args: {
  customer_id: string;
  failure_mode?: FailureMode;
}): Promise<CallToolResult> {
  const customer = findCustomerById(args.customer_id);
  switch (args.failure_mode) {
    case 'timeout':
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              errorCategory: 'transient',
              isRetryable: true,
              description: 'Customer database timed out after 5 seconds. The request is valid and should succeed on retry.',
            }),
          }
        ],
      };
    case 'invalid_format':
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              errorCategory: 'validation',
              isRetryable: true,
              description: `Invalid identifier format: ${args.customer_id}. Expected email (user@domain.com) or ID (CUST-NNNNN).`,
            }),
          }
        ],
      };
    case 'policy_violation':
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              errorCategory: 'business',
              isRetryable: false,
              description: 'Refund of \u00a3750 exceeds the \u00a3500 automatic limit. Escalate to a manager with refund details.',
            }),
          }
        ],
      };
    case 'access_denied':
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              errorCategory: 'permission',
              isRetryable: false,
              description: 'Current service account lacks access to financial records. Escalate to a senior agent.',
            }),
          }
        ],
      };
    default:
      return {
        isError: false,
        content: [
          {
            type: 'text',
            text: JSON.stringify(customer ? { resultCount: 1, customer } : { resultCount: 0 }),
          },
        ],
      };
  }
}

export const customerLookupTool = tool(
  'customer_lookup',
  'Look up a customer by their customer ID. Optionally force a simulated failure mode for testing error handling.',
  {
    customer_id: z.string().describe('The customer identifier, e.g. "CUST-1001"'),
    failure_mode: z
      .enum(['none', 'timeout', 'invalid_format', 'policy_violation', 'access_denied'])
      .optional()
      .describe('Force a simulated failure for testing: timeout, invalid_format, policy_violation, or access_denied'),
  },
  async (args) => customerLookupHandler(args),
);
