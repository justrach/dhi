/**
 * Type-level regression tests (issue #76). Compiled with `npm run typecheck`
 * (strict + noImplicitAny); a failure here is a compile error, not a runtime one.
 *
 *  1. `DhiObject.parse()` / `.safeParse()` return the inferred object type, not `any`
 *  2. dhi schemas are assignable to Zod 4's `$ZodType` (so `z.output<S>` works)
 *  3. `@modelcontextprotocol/sdk` `registerTool` accepts dhi schemas and keeps
 *     contextual typing for the handler arguments
 */
import type { $ZodType, output as ZodOutput, input as ZodInput } from 'zod/v4/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// Checked against the BUILT declarations (dist/schema.d.ts) — exactly what a
// consumer of the npm package sees. (`npm run typecheck` builds first.)
import { z } from '../../dist/schema.js';

type Expect<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

// ---------------------------------------------------------------------------
// 1. Object parse/safeParse inference
// ---------------------------------------------------------------------------
export const docsBundleSchema = z.object({
  schemaVersion: z.literal(1),
  pages: z.array(
    z.object({
      title: z.string().min(1).max(120),
      markdown: z.string().min(1).max(250_000),
    }),
  ).min(1).max(500),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['public', 'private']).default('public'),
});

export type DocsBundle = z.infer<typeof docsBundleSchema>;

export function useParsed(raw: unknown) {
  const parsed = docsBundleSchema.parse(raw);
  type _NotAny = Expect<Equal<IsAny<typeof parsed>, false>>;
  // No implicit-any on callback parameters (TS7006 in the bug report)
  const titles = parsed.pages.map(page => page.title.toUpperCase());
  const version: 1 = parsed.schemaVersion;
  const visibility: 'public' | 'private' = parsed.visibility;
  const tags: string[] | undefined = parsed.tags;

  const result = docsBundleSchema.safeParse(raw);
  if (result.success) {
    type _DataNotAny = Expect<Equal<IsAny<typeof result.data>, false>>;
    const first = result.data.pages[0];
    const md: string | undefined = first?.markdown;
    return { titles, version, visibility, tags, md };
  }
  const message: string = result.error.message;
  return message;
}

// parse() output must equal z.infer<>
type _ParseMatchesInfer = Expect<Equal<ReturnType<typeof docsBundleSchema.parse>, DocsBundle>>;

// Input type keeps defaulted keys optional
type DocsBundleInput = z.input<typeof docsBundleSchema>;
type _InputOptionalDefault = Expect<Equal<DocsBundleInput['visibility'], 'public' | 'private' | undefined>>;

// ---------------------------------------------------------------------------
// 2. Zod 4 core interface assignability
// ---------------------------------------------------------------------------
export const asZodType: $ZodType<DocsBundle, DocsBundleInput> = docsBundleSchema;
export const anyZodType: $ZodType = z.string().email();
export const unionAsZod: $ZodType = z.union([z.string(), z.number()]);

type _ZodOutput = Expect<Equal<ZodOutput<typeof docsBundleSchema>, DocsBundle>>;
type _ZodInput = Expect<Equal<ZodInput<typeof docsBundleSchema>, DocsBundleInput>>;

// ---------------------------------------------------------------------------
// 3. MCP SDK registerTool: dhi object schema AND raw shape, with typed handlers
// ---------------------------------------------------------------------------
export const server = new McpServer({ name: 'typecheck', version: '1.0.0' });

server.registerTool(
  'search_docs',
  {
    description: 'Search docs',
    inputSchema: z.object({
      project: z.string().min(1).max(120),
      query: z.string().min(1).max(500),
      limit: z.number().int().min(1).max(20).default(8),
    }),
  },
  async ({ project, query, limit }) => {
    const p: string = project;
    const q: string = query;
    const l: number = limit;
    return { content: [{ type: 'text', text: `${p}:${q}:${l}` }] };
  },
);

server.registerTool(
  'get_page',
  { inputSchema: { id: z.string().uuid(), verbose: z.boolean().optional() } },
  async ({ id, verbose }) => {
    const i: string = id;
    const v: boolean | undefined = verbose;
    return { content: [{ type: 'text', text: `${i}:${v ?? false}` }] };
  },
);

server.registerTool(
  'import_docs',
  { inputSchema: z.object({ bundle: docsBundleSchema }), outputSchema: z.object({ pages: z.number().int() }) },
  async ({ bundle }) => {
    const count: number = bundle.pages.length;
    return { content: [{ type: 'text', text: String(count) }], structuredContent: { pages: count } };
  },
);

server.registerPrompt(
  'summarize',
  { argsSchema: { page: z.string(), style: z.string().optional() } },
  ({ page, style }) => {
    const p: string = page;
    const s: string | undefined = style;
    return { messages: [{ role: 'user', content: { type: 'text', text: `${p}:${s ?? ''}` } }] };
  },
);
