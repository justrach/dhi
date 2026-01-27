# Durable Agent - Long-Running AI Agents with Cloudflare Durable Objects

Build **stateful, long-running AI agents** using Cloudflare Durable Objects + **dhi** for ultra-fast validation.

## Why Durable Objects for AI Agents?

Durable Objects provide the perfect foundation for AI agents:

| Feature | Benefit for Agents |
|---------|-------------------|
| **Single-threaded execution** | No race conditions - `this.state = x` is always safe |
| **Persistent storage** | Agent memory survives across requests |
| **WebSocket hibernation** | Real-time updates at scale |
| **Alarms** | Background processing for long-running tasks |
| **Edge-deployed** | Low latency, close to users |
| **Globally unique** | Each agent has its own instance |

### Durable Objects vs Redis for Agent State

```
Redis: shared memory → multiple writers → race conditions → locks → sadness

Durable Object: owned memory → single owner → no concurrency → just works
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                        │
│   ┌─────────────┐                                          │
│   │   Router    │ → Routes to agent by ID                  │
│   └──────┬──────┘                                          │
│          │                                                  │
│   ┌──────▼──────────────────────────────────────────────┐  │
│   │           Agent Durable Object                       │  │
│   │  ┌────────────────────────────────────────────────┐ │  │
│   │  │  SQLite Storage (persistent)                   │ │  │
│   │  │  - Agent state                                 │ │  │
│   │  │  - Task queue                                  │ │  │
│   │  │  - Conversation history                        │ │  │
│   │  │  - Step logs                                   │ │  │
│   │  └────────────────────────────────────────────────┘ │  │
│   │  ┌────────────────────────────────────────────────┐ │  │
│   │  │  dhi Validation (77x faster than Zod)          │ │  │
│   │  │  - Task schemas                                │ │  │
│   │  │  - WebSocket messages                          │ │  │
│   │  │  - API request/response                        │ │  │
│   │  └────────────────────────────────────────────────┘ │  │
│   │  ┌────────────────────────────────────────────────┐ │  │
│   │  │  WebSocket Sessions (real-time updates)        │ │  │
│   │  └────────────────────────────────────────────────┘ │  │
│   │  ┌────────────────────────────────────────────────┐ │  │
│   │  │  Alarms (background task processing)           │ │  │
│   │  └────────────────────────────────────────────────┘ │  │
│   └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
bun install

# Run locally
bun run dev

# Deploy to Cloudflare
bun run deploy
```

## API

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Get agent state |
| `POST` | `/task` | Submit a new task |
| `GET` | `/tasks` | List recent tasks |
| `GET` | `/history` | Get conversation history |

### WebSocket Messages

Connect to the agent via WebSocket for real-time updates:

```typescript
const ws = new WebSocket('wss://your-worker.workers.dev?agent=my-agent');

// Submit task
ws.send(JSON.stringify({
  type: 'submit_task',
  task: {
    type: 'research',
    prompt: 'Analyze the benefits of TypeScript validation',
  },
}));

// Receive real-time updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'task_submitted':
      console.log('Task started:', data.task.id);
      break;
    case 'step_completed':
      console.log('Step:', data.step);
      break;
    case 'task_completed':
      console.log('Task done:', data.taskId);
      break;
  }
};
```

## dhi Validation Schemas

All inputs/outputs are validated with dhi for type safety and performance:

```typescript
import { z } from 'dhi';

// Task submission schema
const TaskSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['research', 'analysis', 'code', 'conversation']),
  prompt: z.string().min(1).max(10000),
  config: z.object({
    maxSteps: z.number().int().positive().max(50).default(10),
    timeout: z.number().int().positive().max(300000).default(60000),
  }).optional(),
});

// WebSocket message schema (discriminated union)
const WSMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('submit_task'),
    task: TaskSchema.omit({ id: true }),
  }),
  z.object({
    type: z.literal('cancel_task'),
    taskId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('get_status'),
  }),
]);
```

## Key Patterns

### 1. Background Processing with Alarms

```typescript
// Submit task → schedule alarm → process in background
async submitTask(task: Task) {
  // Store task
  this.sql.exec('INSERT INTO tasks ...');

  // Schedule processing (runs even after request completes)
  await this.ctx.storage.setAlarm(Date.now() + 100);
}

async alarm() {
  // Process task in background
  await this.executeAgentLoop();
}
```

### 2. Real-Time Updates with WebSockets

```typescript
// Broadcast progress to all connected clients
private broadcast(message: unknown) {
  for (const [ws] of this.sessions) {
    ws.send(JSON.stringify(message));
  }
}

// During agent execution
this.broadcast({
  type: 'step_completed',
  step: { toolName: 'research', result: data },
});
```

### 3. Persistent State (No Race Conditions)

```typescript
// This is always safe - single-threaded execution
this.updateState({
  status: 'running',
  currentTaskId: task.id,
  totalSteps: state.totalSteps + 1,
});
```

## Environment Variables

Set via `wrangler secret put`:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |

```bash
wrangler secret put ANTHROPIC_API_KEY
```

## Use Cases

This pattern is ideal for:

- **AI Research Agents** - Long-running research tasks with tool use
- **Code Generation Agents** - Multi-step code writing and testing
- **Data Analysis Agents** - Complex analytical workflows
- **Customer Support Agents** - Stateful conversation with context
- **Workflow Automation** - Multi-step business processes

## Learn More

- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [dhi Documentation](https://github.com/justrach/satya-zig)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
