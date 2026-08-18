/**
 * Shared types for the customer_lookup MCP tool exercise.
 * See EXERCISE.md for the task list.
 */

/** The four failure categories from the article. */
export type ErrorCategory = 'transient' | 'validation' | 'business' | 'permission';

/**
 * Lets a caller force a specific failure category so both the tool and the
 * agent loop can be exercised deterministically, without needing to hit a
 * real flaky backend.
 *
 * - 'none'             -> normal lookup (found, or valid empty result)
 * - 'timeout'          -> simulated transient failure
 * - 'invalid_format'   -> simulated validation failure
 * - 'policy_violation' -> simulated business failure
 * - 'access_denied'    -> simulated permission failure
 */
export type FailureMode = 'none' | 'timeout' | 'invalid_format' | 'policy_violation' | 'access_denied';

/**
 * The structured metadata every error response must carry (Task 3).
 * An error response's `content[0].text`, parsed as JSON, must be exactly
 * this shape - no more, no fewer fields.
 */
export interface StructuredError {
  errorCategory: ErrorCategory;
  isRetryable: boolean;
  description: string;
}

/** Shape of a valid (non-error) empty result payload (Task 4). */
export interface EmptyResult {
  resultCount: 0;
}
