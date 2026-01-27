# dhi + Vercel AI SDK Example

Ultra-fast tool validation for AI agents using **dhi** with the **Vercel AI SDK**.

## Why dhi for AI Agents?

AI agents call tools repeatedly - sometimes hundreds of times per task. Each tool call requires schema validation. dhi provides:

- **77x faster validation** than Zod for valid inputs
- **Built-in JSON Schema generation** (no external library needed)
- **Zod-compatible API** - drop-in replacement

```typescript
import { z } from 'dhi';
import { tool } from 'ai';

// Define tools with dhi schemas
const weatherTool = tool({
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string().min(1),
    unit: z.enum(['celsius', 'fahrenheit']),
  }),
  execute: async ({ location, unit }) => {
    // Tool implementation
  },
});

// JSON Schema generation (built-in!)
const schema = z.object({
  name: z.string(),
  age: z.number().int().positive(),
}).toJsonSchema();
```

## Files

| File | Description |
|------|-------------|
| `demo.ts` | Interactive demo with JSON Schema generation |
| `benchmark-tools.ts` | Benchmark comparing dhi vs Zod for tool validation |
| `agent-example.ts` | Full multi-step agent example |

## Quick Start

```bash
# Install dependencies
bun install

# Run the demo (no API key needed for basic demo)
bun run demo

# Run with live AI (requires API key)
ANTHROPIC_API_KEY=sk-... bun run demo

# Run benchmark
bun run benchmark

# Run full agent example
ANTHROPIC_API_KEY=sk-... bun run agent
```

## Benchmark Results

Typical results comparing dhi vs Zod for AI tool validation:

```
--- Simple Tool Schemas ---
  Weather tool (valid)              dhi:  15.00M  zod:   3.50M  4.3x faster
  Search tool (valid)               dhi:  12.00M  zod:   2.80M  4.3x faster

--- Complex Tool Schemas (Agentic) ---
  Database query tool (valid)       dhi:   8.00M  zod:   1.50M  5.3x faster
  File ops (discriminated union)    dhi:  10.00M  zod:   2.00M  5.0x faster

--- Invalid Input Handling ---
  Weather tool (invalid)            dhi:  25.00M  zod:   0.40M  62.5x faster
```

## Key Features Demonstrated

### 1. Tool Definitions with dhi

```typescript
const databaseTool = tool({
  description: 'Query the database',
  parameters: z.object({
    table: z.enum(['users', 'orders', 'products']),
    filters: z.array(z.object({
      field: z.string(),
      op: z.enum(['eq', 'neq', 'gt', 'lt']),
      value: z.union([z.string(), z.number()]),
    })).optional(),
    limit: z.number().int().positive().max(100).default(10),
  }),
  execute: async (params) => { /* ... */ },
});
```

### 2. Discriminated Unions for Complex Tools

```typescript
const fileOperations = tool({
  description: 'File system operations',
  parameters: z.discriminatedUnion('operation', [
    z.object({
      operation: z.literal('read'),
      path: z.string(),
    }),
    z.object({
      operation: z.literal('write'),
      path: z.string(),
      content: z.string(),
    }),
    z.object({
      operation: z.literal('delete'),
      path: z.string(),
      recursive: z.boolean().default(false),
    }),
  ]),
  execute: async (params) => { /* ... */ },
});
```

### 3. Multi-Step Agents

```typescript
const result = await generateText({
  model: anthropic('claude-3-5-haiku-20241022'),
  tools: {
    research: researchTool,
    analyze: analysisTool,
    database: databaseTool,
    done: doneTool, // No execute = stops agent loop
  },
  toolChoice: 'required',
  maxSteps: 10,
  prompt: 'Research and analyze this topic...',
});
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `OPENAI_API_KEY` | OpenAI API key for GPT models |

## Learn More

- [dhi Documentation](https://github.com/justrach/satya-zig)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [dhi Benchmarks](../../benchmarks/)
