/**
 * Durable Agent - Long-running AI Agents with Cloudflare Durable Objects
 *
 * This example demonstrates how to build stateful AI agents using:
 * - Cloudflare Durable Objects for persistent state (single-threaded, no race conditions)
 * - dhi for ultra-fast validation of all inputs/outputs
 * - WebSockets for real-time updates
 * - Alarms for background processing
 *
 * Why Durable Objects for AI Agents:
 * - Each agent instance owns its state (no locks, no race conditions)
 * - Persistent memory across requests (conversation history, task state)
 * - WebSocket hibernation for real-time updates at scale
 * - Alarms for scheduled/background processing
 * - Edge-deployed, close to users
 */

import { z } from 'dhi';
import { DurableObject } from 'cloudflare:workers';

// ============================================================================
// SCHEMAS - Validated with dhi (77x faster than Zod)
// ============================================================================

/** Task submitted to the agent */
const TaskSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['research', 'analysis', 'code', 'conversation']),
  prompt: z.string().min(1).max(10000),
  config: z.object({
    maxSteps: z.number().int().positive().max(50).default(10),
    timeout: z.number().int().positive().max(300000).default(60000),
    tools: z.array(z.string()).optional(),
  }).optional(),
  createdAt: z.number(),
});
type Task = z.infer<typeof TaskSchema>;

/** Agent step (tool call or text generation) */
const StepSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  type: z.enum(['tool_call', 'text', 'error']),
  content: z.object({
    toolName: z.string().optional(),
    toolArgs: z.record(z.unknown()).optional(),
    toolResult: z.unknown().optional(),
    text: z.string().optional(),
    error: z.string().optional(),
  }),
  timestamp: z.number(),
});
type Step = z.infer<typeof StepSchema>;

/** Message in conversation history */
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  toolCallId: z.string().optional(),
  timestamp: z.number(),
});
type Message = z.infer<typeof MessageSchema>;

/** Agent state */
const AgentStateSchema = z.object({
  id: z.string(),
  status: z.enum(['idle', 'running', 'paused', 'completed', 'error']),
  currentTaskId: z.string().uuid().nullable(),
  totalSteps: z.number().int().min(0),
  createdAt: z.number(),
  lastActiveAt: z.number(),
});
type AgentState = z.infer<typeof AgentStateSchema>;

/** WebSocket message from client */
const WSMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('submit_task'),
    task: TaskSchema.omit({ id: true, createdAt: true }),
  }),
  z.object({
    type: z.literal('cancel_task'),
    taskId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('get_status'),
  }),
  z.object({
    type: z.literal('get_history'),
    limit: z.number().int().positive().max(100).default(50),
  }),
]);
type WSMessage = z.infer<typeof WSMessageSchema>;

/** HTTP request body schemas */
const SubmitTaskBodySchema = TaskSchema.omit({ id: true, createdAt: true });
const GetHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ============================================================================
// DURABLE OBJECT - Stateful AI Agent
// ============================================================================

export class AgentDurableObject extends DurableObject<Env> {
  private sql: SqlStorage;
  private sessions: Map<WebSocket, { id: string }> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initializeDatabase();
  }

  /**
   * Initialize SQLite tables for agent state
   */
  private initializeDatabase() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS agent_state (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'idle',
        current_task_id TEXT,
        total_steps INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        prompt TEXT NOT NULL,
        config TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        error TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS steps (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_call_id TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_steps_task ON steps(task_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    `);

    // Initialize agent state if not exists
    const state = this.sql.exec(`SELECT * FROM agent_state LIMIT 1`).toArray();
    if (state.length === 0) {
      const now = Date.now();
      this.sql.exec(`
        INSERT INTO agent_state (id, status, total_steps, created_at, last_active_at)
        VALUES (?, 'idle', 0, ?, ?)
      `, this.ctx.id.toString(), now, now);
    }
  }

  /**
   * Get current agent state
   */
  private getState(): AgentState {
    const row = this.sql.exec(`SELECT * FROM agent_state LIMIT 1`).one();
    return AgentStateSchema.parse({
      id: row.id,
      status: row.status,
      currentTaskId: row.current_task_id,
      totalSteps: row.total_steps,
      createdAt: row.created_at,
      lastActiveAt: row.last_active_at,
    });
  }

  /**
   * Update agent state
   */
  private updateState(updates: Partial<AgentState>) {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.currentTaskId !== undefined) {
      fields.push('current_task_id = ?');
      values.push(updates.currentTaskId);
    }
    if (updates.totalSteps !== undefined) {
      fields.push('total_steps = ?');
      values.push(updates.totalSteps);
    }

    fields.push('last_active_at = ?');
    values.push(Date.now());

    this.sql.exec(`UPDATE agent_state SET ${fields.join(', ')}`, ...values);
  }

  /**
   * Submit a new task
   */
  private async submitTask(taskInput: z.infer<typeof SubmitTaskBodySchema>): Promise<Task> {
    const task: Task = {
      id: crypto.randomUUID(),
      ...taskInput,
      createdAt: Date.now(),
    };

    // Validate with dhi
    const validated = TaskSchema.parse(task);

    // Store task
    this.sql.exec(`
      INSERT INTO tasks (id, type, prompt, config, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `, validated.id, validated.type, validated.prompt, JSON.stringify(validated.config), validated.createdAt);

    // Update state and schedule processing
    this.updateState({ status: 'running', currentTaskId: validated.id });

    // Schedule alarm to process task (allows async processing)
    await this.ctx.storage.setAlarm(Date.now() + 100);

    // Broadcast to connected clients
    this.broadcast({ type: 'task_submitted', task: validated });

    return validated;
  }

  /**
   * Process task via alarm (background processing)
   */
  async alarm(): Promise<void> {
    const state = this.getState();
    if (state.status !== 'running' || !state.currentTaskId) {
      return;
    }

    const taskRow = this.sql.exec(
      `SELECT * FROM tasks WHERE id = ?`,
      state.currentTaskId
    ).one();

    if (!taskRow || taskRow.status !== 'pending') {
      this.updateState({ status: 'idle', currentTaskId: null });
      return;
    }

    try {
      // Simulate agent steps (in production, this would call AI SDK)
      await this.executeAgentLoop(state.currentTaskId, taskRow.prompt as string);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.sql.exec(
        `UPDATE tasks SET status = 'error', error = ? WHERE id = ?`,
        errorMessage, state.currentTaskId
      );
      this.updateState({ status: 'error', currentTaskId: null });
      this.broadcast({ type: 'task_error', taskId: state.currentTaskId, error: errorMessage });
    }
  }

  /**
   * Execute agent loop (simulated - in production use AI SDK)
   */
  private async executeAgentLoop(taskId: string, prompt: string): Promise<void> {
    const maxSteps = 5;
    let stepCount = 0;

    while (stepCount < maxSteps) {
      stepCount++;

      // Simulate step execution
      const step: Step = {
        id: crypto.randomUUID(),
        taskId,
        type: stepCount < maxSteps ? 'tool_call' : 'text',
        content: stepCount < maxSteps
          ? {
              toolName: 'research',
              toolArgs: { query: prompt },
              toolResult: { results: [`Result for step ${stepCount}`] },
            }
          : { text: `Completed analysis of: ${prompt}` },
        timestamp: Date.now(),
      };

      // Validate and store step
      const validated = StepSchema.parse(step);
      this.sql.exec(
        `INSERT INTO steps (id, task_id, type, content, timestamp) VALUES (?, ?, ?, ?, ?)`,
        validated.id, validated.taskId, validated.type, JSON.stringify(validated.content), validated.timestamp
      );

      // Update total steps
      const state = this.getState();
      this.updateState({ totalSteps: state.totalSteps + 1 });

      // Broadcast progress
      this.broadcast({ type: 'step_completed', step: validated });

      // Small delay between steps
      await new Promise(r => setTimeout(r, 500));
    }

    // Mark task completed
    this.sql.exec(
      `UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?`,
      Date.now(), taskId
    );
    this.updateState({ status: 'idle', currentTaskId: null });
    this.broadcast({ type: 'task_completed', taskId });
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  private broadcast(message: unknown) {
    const data = JSON.stringify(message);
    for (const [ws] of this.sessions) {
      try {
        ws.send(data);
      } catch {
        // Client disconnected
        this.sessions.delete(ws);
      }
    }
  }

  /**
   * Handle HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // REST API
    switch (`${request.method} ${url.pathname}`) {
      case 'GET /status':
        return Response.json(this.getState());

      case 'POST /task': {
        const body = await request.json();
        const parsed = SubmitTaskBodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.format() }, { status: 400 });
        }
        const task = await this.submitTask(parsed.data);
        return Response.json(task, { status: 201 });
      }

      case 'GET /history': {
        const params = Object.fromEntries(url.searchParams);
        const parsed = GetHistoryQuerySchema.safeParse(params);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.format() }, { status: 400 });
        }
        const messages = this.sql.exec(
          `SELECT * FROM messages ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
          parsed.data.limit, parsed.data.offset
        ).toArray();
        return Response.json({ messages });
      }

      case 'GET /tasks': {
        const tasks = this.sql.exec(`SELECT * FROM tasks ORDER BY created_at DESC LIMIT 20`).toArray();
        return Response.json({ tasks });
      }

      default:
        return Response.json({ error: 'Not found' }, { status: 404 });
    }
  }

  /**
   * Handle WebSocket connections
   */
  private handleWebSocket(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    this.sessions.set(server, { id: crypto.randomUUID() });

    // Send current state on connect
    server.send(JSON.stringify({ type: 'connected', state: this.getState() }));

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle WebSocket messages
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    try {
      const data = JSON.parse(message);
      const parsed = WSMessageSchema.safeParse(data);

      if (!parsed.success) {
        ws.send(JSON.stringify({ type: 'error', error: parsed.error.format() }));
        return;
      }

      switch (parsed.data.type) {
        case 'submit_task': {
          const task = await this.submitTask(parsed.data.task);
          ws.send(JSON.stringify({ type: 'task_created', task }));
          break;
        }

        case 'get_status':
          ws.send(JSON.stringify({ type: 'status', state: this.getState() }));
          break;

        case 'get_history': {
          const messages = this.sql.exec(
            `SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?`,
            parsed.data.limit
          ).toArray();
          ws.send(JSON.stringify({ type: 'history', messages }));
          break;
        }

        case 'cancel_task':
          // Cancel current task if it matches
          const state = this.getState();
          if (state.currentTaskId === parsed.data.taskId) {
            this.updateState({ status: 'idle', currentTaskId: null });
            this.sql.exec(
              `UPDATE tasks SET status = 'cancelled' WHERE id = ?`,
              parsed.data.taskId
            );
            ws.send(JSON.stringify({ type: 'task_cancelled', taskId: parsed.data.taskId }));
          }
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  /**
   * Handle WebSocket close
   */
  webSocketClose(ws: WebSocket): void {
    this.sessions.delete(ws);
  }
}

// ============================================================================
// WORKER - Entry point and routing
// ============================================================================

export interface Env {
  AGENT: DurableObjectNamespace<AgentDurableObject>;
  ANTHROPIC_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route to agent by ID or create new
    const agentId = url.searchParams.get('agent') || 'default';
    const id = env.AGENT.idFromName(agentId);
    const agent = env.AGENT.get(id);

    // Forward request to Durable Object
    return agent.fetch(request);
  },
};
