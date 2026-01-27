/**
 * dhi + Vercel AI SDK Demo
 *
 * This example demonstrates how dhi provides ultra-fast validation
 * for AI tool definitions - a perfect use case for its built-in
 * JSON Schema generation.
 *
 * Run: bun run demo.ts
 * (Requires ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable)
 */

import { generateText, tool } from 'ai';
import { z } from '../../schema';

// ============================================================================
// TOOL DEFINITIONS WITH DHI
// ============================================================================

/**
 * Weather Tool - Simple example
 * dhi validates the LLM's tool call arguments at 77x the speed of Zod
 */
const weatherTool = tool({
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string().min(1).describe('City name or location'),
    unit: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature unit'),
  }),
  execute: async ({ location, unit }) => {
    // Simulated weather data
    const temp = Math.floor(Math.random() * 30) + 10;
    const conditions = ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)];
    return {
      location,
      temperature: unit === 'fahrenheit' ? Math.round(temp * 9/5 + 32) : temp,
      unit,
      conditions,
      humidity: Math.floor(Math.random() * 50) + 30,
    };
  },
});

/**
 * Database Query Tool - Complex nested schema
 * Demonstrates dhi's speed advantage with complex validations
 */
const databaseQueryTool = tool({
  description: 'Query the user database with filters',
  parameters: z.object({
    table: z.enum(['users', 'orders', 'products']).describe('Table to query'),
    filters: z.object({
      field: z.string().min(1).describe('Field to filter on'),
      operator: z.enum(['eq', 'neq', 'gt', 'lt', 'contains']).describe('Comparison operator'),
      value: z.union([z.string(), z.number(), z.boolean()]).describe('Value to compare'),
    }).array().optional().describe('Query filters'),
    limit: z.number().int().positive().max(100).default(10).describe('Max results'),
    orderBy: z.object({
      field: z.string(),
      direction: z.enum(['asc', 'desc']).default('asc'),
    }).optional().describe('Sort order'),
  }),
  execute: async ({ table, filters, limit, orderBy }) => {
    // Simulated query execution
    return {
      table,
      rowCount: Math.floor(Math.random() * limit),
      queryTime: `${Math.floor(Math.random() * 50)}ms`,
      filters: filters?.length ?? 0,
      sorted: orderBy ? `${orderBy.field} ${orderBy.direction}` : 'none',
    };
  },
});

/**
 * Code Execution Tool - For agentic workflows
 */
const codeExecutionTool = tool({
  description: 'Execute JavaScript/TypeScript code in a sandboxed environment',
  parameters: z.object({
    code: z.string().min(1).describe('The code to execute'),
    language: z.enum(['javascript', 'typescript']).default('typescript'),
    timeout: z.number().int().positive().max(30000).default(5000).describe('Timeout in ms'),
    env: z.record(z.string()).optional().describe('Environment variables'),
  }),
  execute: async ({ code, language, timeout }) => {
    // Simulated execution
    return {
      success: true,
      output: `Executed ${language} code (${code.length} chars) in ${Math.floor(Math.random() * timeout)}ms`,
      exitCode: 0,
    };
  },
});

/**
 * File Operations Tool - Demonstrates complex union types
 */
const fileOperationsTool = tool({
  description: 'Perform file system operations',
  parameters: z.discriminatedUnion('operation', [
    z.object({
      operation: z.literal('read'),
      path: z.string().min(1),
      encoding: z.enum(['utf8', 'base64', 'binary']).default('utf8'),
    }),
    z.object({
      operation: z.literal('write'),
      path: z.string().min(1),
      content: z.string(),
      append: z.boolean().default(false),
    }),
    z.object({
      operation: z.literal('delete'),
      path: z.string().min(1),
      recursive: z.boolean().default(false),
    }),
    z.object({
      operation: z.literal('list'),
      path: z.string().min(1),
      pattern: z.string().optional(),
    }),
  ]),
  execute: async (params) => {
    return {
      operation: params.operation,
      path: params.path,
      success: true,
      message: `${params.operation} operation completed`,
    };
  },
});

// ============================================================================
// JSON SCHEMA GENERATION DEMO
// ============================================================================

console.log('='.repeat(70));
console.log('  dhi + Vercel AI SDK - Tool Validation Demo');
console.log('='.repeat(70));
console.log('');

// Show JSON Schema generation (unique to dhi - Zod needs external library)
console.log('--- JSON Schema Generation (Built-in to dhi) ---');
console.log('');

const UserSchema = z.object({
  name: z.string().min(1).max(100).describe("User's full name"),
  email: z.string().email().describe("User's email address"),
  age: z.number().int().positive().max(150).optional(),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
  preferences: z.object({
    theme: z.enum(['light', 'dark']),
    notifications: z.boolean(),
  }).optional(),
});

console.log('Schema Definition:');
console.log('  const UserSchema = z.object({');
console.log('    name: z.string().min(1).max(100),');
console.log('    email: z.string().email(),');
console.log('    age: z.number().int().positive().optional(),');
console.log('    role: z.enum(["admin", "user", "guest"]),');
console.log('  })');
console.log('');
console.log('Generated JSON Schema (UserSchema.toJsonSchema()):');
console.log(JSON.stringify(UserSchema.toJsonSchema(), null, 2));
console.log('');

// ============================================================================
// VALIDATION SPEED DEMO
// ============================================================================

console.log('--- Validation Speed Demo ---');
console.log('');

// Simulate LLM tool call responses
const validToolCalls = [
  { location: 'San Francisco', unit: 'celsius' },
  { location: 'Tokyo', unit: 'fahrenheit' },
  { location: 'London', unit: 'celsius' },
];

const weatherParams = z.object({
  location: z.string().min(1),
  unit: z.enum(['celsius', 'fahrenheit']),
});

// Benchmark validation
const iterations = 100_000;
const start = performance.now();
for (let i = 0; i < iterations; i++) {
  weatherParams.safeParse(validToolCalls[i % 3]);
}
const elapsed = performance.now() - start;
const opsPerSec = (iterations / elapsed) * 1000;

console.log(`Validated ${iterations.toLocaleString()} tool calls in ${elapsed.toFixed(1)}ms`);
console.log(`Speed: ${(opsPerSec / 1e6).toFixed(2)}M validations/sec`);
console.log('');

// ============================================================================
// INTERACTIVE DEMO (if API key available)
// ============================================================================

const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

if (hasAnthropicKey || hasOpenAIKey) {
  console.log('--- Live AI Tool Calling Demo ---');
  console.log('');

  try {
    // Dynamic import based on available API key
    const provider = hasAnthropicKey
      ? (await import('@ai-sdk/anthropic')).anthropic
      : (await import('@ai-sdk/openai')).openai;

    const model = hasAnthropicKey
      ? provider('claude-3-5-haiku-20241022')
      : provider('gpt-4o-mini');

    console.log(`Using: ${hasAnthropicKey ? 'Claude 3.5 Haiku' : 'GPT-4o-mini'}`);
    console.log('');

    const result = await generateText({
      model,
      tools: {
        weather: weatherTool,
        database: databaseQueryTool,
      },
      maxSteps: 3,
      prompt: 'What is the weather in Tokyo? Also, query the users table for the first 5 records.',
    });

    console.log('AI Response:');
    console.log(result.text || '(Tool calls executed)');
    console.log('');
    console.log('Tool Calls Made:');
    for (const step of result.steps) {
      for (const toolCall of step.toolCalls) {
        console.log(`  - ${toolCall.toolName}(${JSON.stringify(toolCall.args)})`);
      }
    }
    console.log('');
    console.log('Tool Results:');
    for (const step of result.steps) {
      for (const toolResult of step.toolResults) {
        console.log(`  - ${toolResult.toolName}: ${JSON.stringify(toolResult.result)}`);
      }
    }
  } catch (error) {
    console.log('Error:', (error as Error).message);
  }
} else {
  console.log('--- Live Demo Skipped ---');
  console.log('Set ANTHROPIC_API_KEY or OPENAI_API_KEY to run live AI demo');
  console.log('');
  console.log('Example:');
  console.log('  ANTHROPIC_API_KEY=sk-... bun run demo.ts');
}

console.log('');
console.log('='.repeat(70));
console.log('  Demo complete! See benchmark-tools.ts for speed comparison vs Zod');
console.log('='.repeat(70));
