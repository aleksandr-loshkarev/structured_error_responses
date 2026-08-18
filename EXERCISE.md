# Build Exercise: Structured Error Responses for All Four Categories

Source: [Structured Error Responses](https://claudecertificationguide.com/learn/2-tool-design-mcp/2-2-structured-error-responses)

Difficulty: ~45 minutes.

## What's already set up for you

- `src/types.ts` - `ErrorCategory`, `FailureMode`, and the `StructuredError` shape. Done, read-only.
- `src/customer-db.ts` - a tiny mock customer database (`findCustomerById`). Done, read-only.
- `src/customer-lookup-tool.ts` - the MCP tool. The `tool(...)` wiring is done for you;
  `customerLookupHandler` currently throws `Not implemented` - **this is Tasks 1-4**.
- `src/agent-loop.ts` - `runCustomerLookupAgent` currently throws `Not implemented` - **this is Task 5**.
- `src/server.ts` - a manual smoke-test harness (`npm run dev`) so you can chat with the tool live
  once it's implemented. Requires `ANTHROPIC_API_KEY`.
- `tests/` - automated checkers for every task. Run them with `npm test`. They currently fail
  because the exercise isn't implemented yet - that's expected. Don't edit the tests.

## Tasks

### Task 1 - the MCP tool

Implement `customerLookupHandler` in [src/customer-lookup-tool.ts](src/customer-lookup-tool.ts) so it
queries the mock customer database via `findCustomerById`, using the `failure_mode` parameter to
simulate each of the four failure categories on demand.

### Task 2 - four error response types

Within that same handler, produce four distinct, correctly-shaped error responses:

| `failure_mode`      | `errorCategory` | `isRetryable` |
| -------------------- | ---------------- | -------------- |
| `timeout`            | `transient`      | `true`         |
| `invalid_format`     | `validation`     | `true`         |
| `policy_violation`   | `business`       | `false`        |
| `access_denied`      | `permission`     | `false`        |

Every one of these must set `isError: true` on the returned `CallToolResult`.

### Task 3 - structured error metadata

Each error response's `content[0].text` must be a JSON string that parses to **exactly** three
fields: `errorCategory`, `isRetryable`, and a human-readable `description`. No extra fields, no
missing fields.

### Task 4 - valid empty result vs. access failure

When `failure_mode` is `'none'` (or omitted):

- If the customer is found: `isError: false`, and the payload includes `resultCount: 1` plus the
  customer record.
- If the customer is **not** found: `isError: false` (this was a successful query - it just found
  nothing!) with a payload of `{ resultCount: 0 }`. This must be structurally distinct from every
  error branch above - no `errorCategory` field should be present.

### Task 5 - the agent recovery loop

Implement `runCustomerLookupAgent` in [src/agent-loop.ts](src/agent-loop.ts). Given a customer ID,
a `failure_mode`, and a `callTool` function, it should call the tool and branch on the structured
error metadata it gets back:

- **transient** -> retry, up to `deps.maxRetries` attempts (default 3), sleeping via `deps.sleep`
  with an increasing delay between attempts. Record a `retry` action per attempt, and a `give_up`
  action if every attempt fails.
- **validation** -> don't blindly retry the same bad input. Record a `fix_input` action and stop.
- **business** -> never retry. Record an `escalate` action and stop.
- **permission** -> never retry. Record a `request_credentials` action and stop.
- **success** (`isError: false`, including a valid empty result) -> record a `success` action with
  the resulting `resultCount` and stop.

Return the full ordered trace of actions taken (see the `AgentAction` union in `agent-loop.ts` for
the exact shape of each).

## Checking your work

```bash
npm test
```

All tests in `tests/customer-lookup-tool.test.ts` and `tests/agent-loop.test.ts` should pass once
Tasks 1-5 are complete. You can also sanity-check types with:

```bash
npx tsc --noEmit
```

And, optionally, chat with the tool live once it's implemented:

```bash
ANTHROPIC_API_KEY=sk-... npm run dev
```
