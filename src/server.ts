/**
 * Manual smoke test: runs a live agent session with the customer_lookup tool
 * attached, so you can chat with it and see your error responses in action
 * once Tasks 1-4 are implemented.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npm run dev
 *
 * Try prompts like:
 *   "Look up customer CUST-1001"
 *   "Look up customer CUST-9999" (valid empty result)
 *   "Look up customer CUST-1001 but simulate a timeout"
 *   "Look up customer CUST-1001 but simulate a policy violation"
 */
import { query, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { customerLookupTool } from './customer-lookup-tool.js';

const server = createSdkMcpServer({
  name: 'customer-db',
  version: '1.0.0',
  tools: [customerLookupTool],
});

const prompt = process.argv[2] ?? 'Look up customer CUST-1001, then look up customer CUST-9999.';

const result = query({
  prompt,
  options: {
    mcpServers: { 'customer-db': server },
  },
});

for await (const message of result) {
  if (message.type === 'assistant') {
    for (const block of message.message.content) {
      if (block.type === 'text') {
        console.log(block.text);
      }
    }
  }
}
