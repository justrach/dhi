/**
 * MCP SDK compatibility (issue #76)
 *
 * `@modelcontextprotocol/sdk` detects Zod 4 schemas via `_zod` and then hands
 * them to Zod's own core helpers (toJSONSchema / safeParse / shape access).
 * This test registers tools and prompts with dhi schemas on a real McpServer,
 * talks to it over an in-memory transport and checks:
 *   - tool discovery generates JSON Schema from a dhi object schema
 *   - a raw shape `{ key: dhiSchema }` works too
 *   - valid arguments reach the handler parsed (defaults applied)
 *   - invalid arguments are rejected at runtime
 *   - prompt argument metadata (name / required / description) is derived
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from '../schema';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}: ${e?.stack ?? e}`);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const searchDocsInput = z.object({
  project: z.string().min(1).max(120).describe('Project slug'),
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(20).default(8),
  tags: z.array(z.string()).optional(),
});

const docsBundleSchema = z.object({
  schemaVersion: z.literal(1),
  pages: z.array(
    z.object({
      title: z.string().min(1).max(120),
      markdown: z.string().min(1).max(250_000),
    }),
  ).min(1).max(500),
});

const server = new McpServer({ name: 'dhi-compat-test', version: '1.0.0' });

let lastArgs: any = null;
server.registerTool(
  'search_docs',
  { description: 'Search docs', inputSchema: searchDocsInput },
  async ({ project, query, limit, tags }) => {
    lastArgs = { project, query, limit, tags };
    return { content: [{ type: 'text', text: `${project}:${query}:${limit}` }] };
  },
);

// Raw shape form: `{ key: schema }`
server.registerTool(
  'get_page',
  { description: 'Get page', inputSchema: { id: z.string().uuid(), verbose: z.boolean().optional() } },
  async ({ id, verbose }) => ({ content: [{ type: 'text', text: `${id}:${verbose ?? false}` }] }),
);

// Nested schema (docs bundle) as a tool input
server.registerTool(
  'import_docs',
  { description: 'Import a docs bundle', inputSchema: z.object({ bundle: docsBundleSchema }) },
  async ({ bundle }) => ({ content: [{ type: 'text', text: String(bundle.pages.length) }] }),
);

// Tool with an output schema
server.registerTool(
  'stats',
  {
    description: 'Stats',
    inputSchema: z.object({ project: z.string() }),
    outputSchema: z.object({ pages: z.number().int(), updatedAt: z.string().datetime() }),
  },
  async ({ project }) => {
    const structuredContent = { pages: project.length, updatedAt: '2026-01-01T00:00:00Z' };
    return { content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent };
  },
);

server.registerPrompt(
  'summarize',
  {
    description: 'Summarize a page',
    argsSchema: { page: z.string().describe('Page id'), style: z.string().optional() },
  },
  ({ page, style }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `${page}:${style ?? 'plain'}` } }] }),
);

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
const client = new Client({ name: 'dhi-compat-client', version: '1.0.0' });
await client.connect(clientTransport);

console.log('MCP SDK compatibility (dhi schemas on McpServer)');

await test('tools/list generates JSON Schema from a dhi object schema', async () => {
  const { tools } = await client.listTools();
  const tool = tools.find(t => t.name === 'search_docs');
  assert(tool, 'search_docs not listed');
  const schema = tool.inputSchema as any;
  assert(schema.type === 'object', `expected object schema, got ${JSON.stringify(schema)}`);
  assert(schema.properties.project.type === 'string', 'project should be a string');
  assert(schema.properties.project.minLength === 1 && schema.properties.project.maxLength === 120, 'string bounds missing');
  assert(schema.properties.project.description === 'Project slug', 'description missing');
  assert(schema.properties.limit.type === 'integer', 'limit should be an integer');
  assert(schema.properties.limit.minimum === 1 && schema.properties.limit.maximum === 20, 'number bounds missing');
  assert(schema.properties.tags.type === 'array' && schema.properties.tags.items.type === 'string', 'array schema missing');
  const required = schema.required as string[];
  assert(required.includes('project') && required.includes('query'), `required keys wrong: ${required}`);
  assert(!required.includes('limit') && !required.includes('tags'), `defaulted/optional keys must not be required: ${required}`);
});

await test('tools/list works for a raw shape of dhi schemas', async () => {
  const { tools } = await client.listTools();
  const tool = tools.find(t => t.name === 'get_page');
  assert(tool, 'get_page not listed');
  const schema = tool.inputSchema as any;
  assert(schema.type === 'object', 'expected object schema');
  assert(schema.properties.id.type === 'string' && schema.properties.id.format === 'uuid', 'uuid format missing');
  assert(schema.properties.verbose.type === 'boolean', 'boolean missing');
  assert(JSON.stringify(schema.required) === JSON.stringify(['id']), `required wrong: ${JSON.stringify(schema.required)}`);
});

await test('tools/list handles nested object/array/literal schemas', async () => {
  const { tools } = await client.listTools();
  const tool = tools.find(t => t.name === 'import_docs');
  assert(tool, 'import_docs not listed');
  const bundle = (tool.inputSchema as any).properties.bundle;
  assert(bundle.type === 'object', 'bundle should be an object');
  assert(bundle.properties.schemaVersion.const === 1, 'literal should become const');
  assert(bundle.properties.pages.type === 'array' && bundle.properties.pages.minItems === 1 && bundle.properties.pages.maxItems === 500, 'array bounds missing');
  assert(bundle.properties.pages.items.properties.title.maxLength === 120, 'nested string bounds missing');
});

await test('tools/list exposes an output schema', async () => {
  const { tools } = await client.listTools();
  const tool = tools.find(t => t.name === 'stats');
  assert(tool && tool.outputSchema, 'stats output schema missing');
  const out = tool.outputSchema as any;
  assert(out.properties.pages.type === 'integer' && out.properties.updatedAt.format === 'date-time', 'output schema wrong');
});

await test('tools/call parses valid arguments and applies defaults', async () => {
  const res: any = await client.callTool({ name: 'search_docs', arguments: { project: 'smolify', query: 'edge' } });
  assert(!res.isError, `unexpected error: ${JSON.stringify(res)}`);
  assert(res.content[0].text === 'smolify:edge:8', `wrong text: ${res.content[0].text}`);
  assert(lastArgs.limit === 8, 'default not applied');
  assert(lastArgs.tags === undefined, 'optional should stay undefined');
});

await test('tools/call rejects invalid arguments at runtime', async () => {
  let rejected = false;
  try {
    const res: any = await client.callTool({ name: 'search_docs', arguments: { project: '', query: 'edge', limit: 50 } });
    rejected = !!res.isError;
    if (rejected) {
      const text = String(res.content?.[0]?.text ?? '');
      assert(/project|limit|Invalid|small|big/i.test(text), `error text should mention the failing fields: ${text}`);
    }
  } catch (e: any) {
    rejected = true;
    assert(/-32602|Invalid|project|limit/i.test(String(e?.message)), `unexpected error: ${e?.message}`);
  }
  assert(rejected, 'invalid arguments were accepted');
});

await test('tools/call rejects wrong types', async () => {
  let rejected = false;
  try {
    const res: any = await client.callTool({ name: 'search_docs', arguments: { project: 42, query: 'edge' } });
    rejected = !!res.isError;
  } catch {
    rejected = true;
  }
  assert(rejected, 'wrong type was accepted');
});

await test('tools/call validates a raw-shape tool', async () => {
  const ok: any = await client.callTool({ name: 'get_page', arguments: { id: '550e8400-e29b-41d4-a716-446655440000' } });
  assert(!ok.isError && ok.content[0].text === '550e8400-e29b-41d4-a716-446655440000:false', `unexpected: ${JSON.stringify(ok)}`);
  let rejected = false;
  try {
    const bad: any = await client.callTool({ name: 'get_page', arguments: { id: 'not-a-uuid' } });
    rejected = !!bad.isError;
  } catch {
    rejected = true;
  }
  assert(rejected, 'invalid uuid was accepted');
});

await test('tools/call validates nested bundles', async () => {
  const ok: any = await client.callTool({
    name: 'import_docs',
    arguments: { bundle: { schemaVersion: 1, pages: [{ title: 'Intro', markdown: '# Hi' }] } },
  });
  assert(!ok.isError && ok.content[0].text === '1', `unexpected: ${JSON.stringify(ok)}`);
  let rejected = false;
  try {
    const bad: any = await client.callTool({ name: 'import_docs', arguments: { bundle: { schemaVersion: 2, pages: [] } } });
    rejected = !!bad.isError;
  } catch {
    rejected = true;
  }
  assert(rejected, 'invalid bundle was accepted');
});

await test('tools/call validates structured output against the output schema', async () => {
  const res: any = await client.callTool({ name: 'stats', arguments: { project: 'abc' } });
  assert(!res.isError, `unexpected error: ${JSON.stringify(res)}`);
  assert(res.structuredContent.pages === 3, 'structured content missing');
});

await test('prompts/list derives argument metadata from dhi schemas', async () => {
  const { prompts } = await client.listPrompts();
  const prompt = prompts.find(p => p.name === 'summarize');
  assert(prompt, 'summarize not listed');
  const args = prompt.arguments ?? [];
  const page = args.find(a => a.name === 'page');
  const style = args.find(a => a.name === 'style');
  assert(page && page.required === true && page.description === 'Page id', `page arg wrong: ${JSON.stringify(page)}`);
  assert(style && style.required === false, `style arg wrong: ${JSON.stringify(style)}`);
});

await test('prompts/get validates and passes arguments', async () => {
  const res = await client.getPrompt({ name: 'summarize', arguments: { page: 'p1' } });
  const content: any = res.messages[0].content;
  assert(content.text === 'p1:plain', `unexpected prompt text: ${content.text}`);
});

await client.close();
await server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
