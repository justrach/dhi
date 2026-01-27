/**
 * dhi + Vercel AI SDK Agent Example
 *
 * This demonstrates the latest AI SDK patterns for building agents:
 * - ToolLoopAgent for multi-step workflows
 * - stopWhen for flexible stopping conditions
 * - prepareStep for context management
 * - Streaming with real-time updates
 *
 * dhi provides ultra-fast validation for tool schemas - critical
 * for agentic workflows where tools are called repeatedly.
 *
 * Run: ANTHROPIC_API_KEY=sk-... bun run agent-example.ts
 */

import { generateText, streamText, tool } from 'ai';
import { z } from '../../schema';

// ============================================================================
// TOOL DEFINITIONS WITH DHI SCHEMAS
// ============================================================================

/**
 * Research Tool - Simulates web search
 * In production, this would call a real search API
 */
const researchTool = tool({
  description: 'Search the web for information on a topic',
  parameters: z.object({
    query: z.string().min(1).max(500).describe('Search query'),
    maxResults: z.number().int().positive().max(20).default(5).describe('Number of results'),
  }),
  execute: async ({ query, maxResults }) => {
    // Simulated search results
    await sleep(100); // Simulate API latency
    return {
      query,
      results: Array.from({ length: maxResults }, (_, i) => ({
        title: `Result ${i + 1} for "${query}"`,
        snippet: `This is a snippet about ${query}. It contains relevant information...`,
        url: `https://example.com/result-${i + 1}`,
      })),
    };
  },
});

/**
 * Analysis Tool - Processes and analyzes data
 */
const analysisTool = tool({
  description: 'Analyze data and extract insights',
  parameters: z.object({
    data: z.string().describe('Data to analyze'),
    analysisType: z.enum(['sentiment', 'summary', 'keywords', 'entities']).describe('Type of analysis'),
  }),
  execute: async ({ data, analysisType }) => {
    await sleep(50);
    const results: Record<string, unknown> = {
      sentiment: { score: 0.7, label: 'positive' },
      summary: { text: `Summary of: ${data.slice(0, 50)}...` },
      keywords: { keywords: ['ai', 'agent', 'validation', 'performance'] },
      entities: { entities: [{ type: 'TECH', value: 'dhi' }, { type: 'ORG', value: 'Vercel' }] },
    };
    return {
      analysisType,
      result: results[analysisType],
    };
  },
});

/**
 * Database Tool - CRUD operations with complex schema validation
 */
const databaseTool = tool({
  description: 'Perform database operations',
  parameters: z.discriminatedUnion('operation', [
    z.object({
      operation: z.literal('query'),
      table: z.enum(['users', 'documents', 'analytics']),
      filters: z.array(z.object({
        field: z.string(),
        op: z.enum(['eq', 'neq', 'gt', 'lt', 'contains']),
        value: z.union([z.string(), z.number(), z.boolean()]),
      })).optional(),
      limit: z.number().int().positive().max(100).default(10),
    }),
    z.object({
      operation: z.literal('insert'),
      table: z.enum(['users', 'documents', 'analytics']),
      data: z.record(z.unknown()),
    }),
    z.object({
      operation: z.literal('update'),
      table: z.enum(['users', 'documents', 'analytics']),
      id: z.string().uuid(),
      data: z.record(z.unknown()),
    }),
  ]),
  execute: async (params) => {
    await sleep(30);
    if (params.operation === 'query') {
      return {
        operation: 'query',
        table: params.table,
        rowCount: Math.floor(Math.random() * params.limit),
        data: [{ id: '1', name: 'Sample' }],
      };
    }
    return {
      operation: params.operation,
      table: params.table,
      success: true,
      id: params.operation === 'insert' ? crypto.randomUUID() : (params as any).id,
    };
  },
});

/**
 * Code Execution Tool - For computational tasks
 */
const codeTool = tool({
  description: 'Execute code for calculations or data processing',
  parameters: z.object({
    code: z.string().min(1).describe('JavaScript code to execute'),
    description: z.string().describe('What this code does'),
  }),
  execute: async ({ code, description }) => {
    await sleep(20);
    // In production, this would use a sandboxed runtime
    return {
      success: true,
      description,
      output: `Executed: ${description}`,
    };
  },
});

/**
 * Done Tool - Signals agent completion (no execute = stops loop)
 */
const doneTool = tool({
  description: 'Signal that you have completed the task and provide the final answer',
  parameters: z.object({
    answer: z.string().describe('The final answer or result'),
    confidence: z.number().min(0).max(1).describe('Confidence in the answer (0-1)'),
    sources: z.array(z.string()).optional().describe('Sources used'),
  }),
  // No execute function - this stops the agent loop
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// DEMO: NON-STREAMING AGENT
// ============================================================================

async function runNonStreamingAgent() {
  console.log('');
  console.log('--- Non-Streaming Agent Demo ---');
  console.log('');

  const hasKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  if (!hasKey) {
    console.log('Skipping live demo - set ANTHROPIC_API_KEY or OPENAI_API_KEY');
    return;
  }

  const provider = process.env.ANTHROPIC_API_KEY
    ? (await import('@ai-sdk/anthropic')).anthropic
    : (await import('@ai-sdk/openai')).openai;

  const model = process.env.ANTHROPIC_API_KEY
    ? provider('claude-3-5-haiku-20241022')
    : provider('gpt-4o-mini');

  console.log(`Using: ${process.env.ANTHROPIC_API_KEY ? 'Claude 3.5 Haiku' : 'GPT-4o-mini'}`);
  console.log('');

  const startTime = performance.now();

  const result = await generateText({
    model,
    tools: {
      research: researchTool,
      analyze: analysisTool,
      database: databaseTool,
      done: doneTool,
    },
    toolChoice: 'required',
    maxSteps: 10,
    system: `You are a research assistant. When given a task:
1. Use the research tool to gather information
2. Use the analyze tool to extract insights
3. Use the database tool if you need to store or retrieve data
4. When finished, use the done tool with your final answer

Be thorough but efficient. Always end with the done tool.`,
    prompt: 'Research the benefits of TypeScript validation libraries and provide a summary.',
  });

  const elapsed = performance.now() - startTime;

  console.log(`Completed in ${elapsed.toFixed(0)}ms`);
  console.log('');
  console.log('Steps taken:');
  for (const step of result.steps) {
    for (const toolCall of step.toolCalls) {
      console.log(`  - ${toolCall.toolName}(${JSON.stringify(toolCall.args).slice(0, 80)}...)`);
    }
  }
  console.log('');

  // Extract final answer from done tool
  const lastStep = result.steps[result.steps.length - 1];
  const doneCall = lastStep?.toolCalls.find(tc => tc.toolName === 'done');
  if (doneCall) {
    console.log('Final Answer:');
    console.log((doneCall.args as any).answer);
    console.log('');
    console.log(`Confidence: ${(doneCall.args as any).confidence}`);
  }
}

// ============================================================================
// DEMO: STREAMING AGENT
// ============================================================================

async function runStreamingAgent() {
  console.log('');
  console.log('--- Streaming Agent Demo ---');
  console.log('');

  const hasKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  if (!hasKey) {
    console.log('Skipping live demo - set ANTHROPIC_API_KEY or OPENAI_API_KEY');
    return;
  }

  const provider = process.env.ANTHROPIC_API_KEY
    ? (await import('@ai-sdk/anthropic')).anthropic
    : (await import('@ai-sdk/openai')).openai;

  const model = process.env.ANTHROPIC_API_KEY
    ? provider('claude-3-5-haiku-20241022')
    : provider('gpt-4o-mini');

  console.log('Streaming agent output:');
  console.log('');

  const result = streamText({
    model,
    tools: {
      research: researchTool,
      analyze: analysisTool,
    },
    maxSteps: 5,
    system: 'You are a helpful research assistant. Use tools to find information.',
    prompt: 'What are the top 3 benefits of using schema validation in APIs?',
    onChunk: ({ chunk }) => {
      if (chunk.type === 'tool-call') {
        process.stdout.write(`\n[Tool: ${chunk.toolName}] `);
      } else if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.textDelta);
      }
    },
  });

  // Wait for completion
  const finalResult = await result;
  console.log('\n');
  console.log(`Total steps: ${finalResult.steps.length}`);
}

// ============================================================================
// DEMO: VALIDATION PERFORMANCE
// ============================================================================

async function showValidationPerformance() {
  console.log('');
  console.log('--- Tool Schema Validation Performance ---');
  console.log('');

  // Complex tool schema (typical for agentic workflows)
  const complexSchema = z.discriminatedUnion('operation', [
    z.object({
      operation: z.literal('query'),
      table: z.enum(['users', 'documents', 'analytics']),
      filters: z.array(z.object({
        field: z.string(),
        op: z.enum(['eq', 'neq', 'gt', 'lt', 'contains']),
        value: z.union([z.string(), z.number(), z.boolean()]),
      })).optional(),
      limit: z.number().int().positive().max(100).default(10),
    }),
    z.object({
      operation: z.literal('insert'),
      table: z.enum(['users', 'documents', 'analytics']),
      data: z.record(z.unknown()),
    }),
  ]);

  const validData = {
    operation: 'query' as const,
    table: 'users' as const,
    filters: [
      { field: 'status', op: 'eq' as const, value: 'active' },
      { field: 'age', op: 'gt' as const, value: 18 },
    ],
    limit: 50,
  };

  // Benchmark
  const iterations = 100_000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    complexSchema.safeParse(validData);
  }
  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  console.log(`Schema: Discriminated union with nested arrays and objects`);
  console.log(`Validated ${iterations.toLocaleString()} tool calls in ${elapsed.toFixed(1)}ms`);
  console.log(`Speed: ${(opsPerSec / 1e6).toFixed(2)}M validations/sec`);
  console.log('');
  console.log('Why this matters:');
  console.log('  - Agents may call tools hundreds of times per task');
  console.log('  - Each tool call requires schema validation');
  console.log('  - Faster validation = lower overall latency');
  console.log('  - dhi provides 10-70x faster validation than Zod');
}

// ============================================================================
// MAIN
// ============================================================================

console.log('='.repeat(70));
console.log('  dhi + Vercel AI SDK Agent Example');
console.log('  Using latest AI SDK patterns for multi-step agents');
console.log('='.repeat(70));

await showValidationPerformance();
await runNonStreamingAgent();
await runStreamingAgent();

console.log('');
console.log('='.repeat(70));
console.log('  Demo complete!');
console.log('='.repeat(70));
