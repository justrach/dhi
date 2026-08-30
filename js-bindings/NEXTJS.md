# Using dhi with Next.js

dhi is a drop-in Zod 4 replacement that works in every Next.js target — Node
server, Edge Runtime, browser, Server Actions, Route Handlers, Middleware — and
deploys unchanged through Vercel and OpenNext/Cloudflare.

## Quick Start

### 1. Install

```bash
npm install dhi
# or
pnpm add dhi
# or
yarn add dhi
```

### 2. Import

```typescript
import { z } from 'dhi';
```

That's it. The package's conditional exports pick the right build for every
Next.js target automatically, and every build is the same runtime-agnostic
core: **no WASM to load, no top-level await, no `next.config.js` changes**.
It bundles cleanly with webpack, Turbopack and OpenNext.

If you prefer an explicit entry point, `dhi/nextjs` is the same code:

```typescript
import { z } from 'dhi/nextjs';
```

> `dhi/schema-nextjs` (the path documented in older versions of this guide) is
> kept as an alias of `dhi/nextjs`.

### 3. Configure Next.js

Nothing to configure — dhi needs no WASM/experiments flags.

## Usage Examples

The API is Zod 4's API, so every example below is what you would write with
`import { z } from 'zod'`.

### Server Component (App Router)

```typescript
import { z } from 'dhi';

const PostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  published: z.boolean().default(false),
});

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`https://api.example.com/posts/${id}`);
  const result = PostSchema.safeParse(await res.json());

  if (!result.success) {
    return <div>Invalid post data: {z.prettifyError(result.error)}</div>;
  }

  return (
    <article>
      <h1>{result.data.title}</h1>
      <p>{result.data.content}</p>
    </article>
  );
}
```

### Route Handler

```typescript
// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { z } from 'dhi';

const CreateUser = z.object({
  name: z.string().min(2).max(100),
  email: z.email(),
  age: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const result = CreateUser.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ errors: result.error.issues }, { status: 400 });
  }
  const user = result.data; // { name: string; email: string; age?: number }
  return NextResponse.json({ user }, { status: 201 });
}
```

### Server Action

```typescript
'use server';

import { z } from 'dhi';

const Contact = z.object({
  email: z.email(),
  message: z.string().trim().min(10).max(2000),
});

export async function sendContact(formData: FormData) {
  const parsed = Contact.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, issues: parsed.error.issues };
  // ...send it
  return { ok: true };
}
```

### Client Component

```typescript
'use client';

import { useState } from 'react';
import { z } from 'dhi';

const UserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.email(),
  age: z.coerce.number().int().positive(),
});

export default function UserForm() {
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = UserSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    setError(result.success ? null : z.prettifyError(result.error));
  }

  return (
    <form onSubmit={onSubmit}>
      {/* fields */}
      <button type="submit">Save</button>
      {error && <pre>{error}</pre>}
    </form>
  );
}
```

### Middleware / Edge Runtime

```typescript
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'dhi';

const Query = z.object({ page: z.coerce.number().int().min(1).default(1) });

export function middleware(request: NextRequest) {
  const result = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!result.success) return NextResponse.json({ error: 'Bad query' }, { status: 400 });
  return NextResponse.next();
}
```

The Edge Runtime build is the same core as the Node build — same JIT, same
behaviour — so there is nothing special to do for `export const runtime = 'edge'`.

## MCP servers (`@modelcontextprotocol/sdk`)

dhi schemas are accepted by `McpServer.registerTool()` / `registerPrompt()`
directly (object schemas, raw shapes and output schemas), with full contextual
typing for the handler arguments — no Zod fallback needed:

```typescript
import { z } from 'dhi';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const server = new McpServer({ name: 'docs', version: '1.0.0' });

server.registerTool(
  'search_docs',
  {
    description: 'Search the docs',
    inputSchema: z.object({
      project: z.string().min(1).max(120),
      query: z.string().min(1).max(500),
      limit: z.number().int().min(1).max(20).default(8),
    }),
  },
  async ({ project, query, limit }) => {
    // project: string, query: string, limit: number
    return { content: [{ type: 'text', text: `${project}:${query}:${limit}` }] };
  },
);
```

## OpenNext / Cloudflare

`@opennextjs/cloudflare` resolves the `workerd` export condition to
`dhi/cloudflare`, which is the same core again. No WASM bindings, no
`nodejs_compat` requirements from dhi itself.

## Type inference

```typescript
const docsBundleSchema = z.object({
  schemaVersion: z.literal(1),
  pages: z.array(z.object({ title: z.string().min(1), markdown: z.string().min(1) })).min(1),
});

type DocsBundle = z.infer<typeof docsBundleSchema>;
// { schemaVersion: 1; pages: { title: string; markdown: string }[] }

const bundle = docsBundleSchema.parse(input); // typed as DocsBundle, not any
bundle.pages.map(page => page.title);         // page: { title: string; markdown: string }
```

## Performance

There is no initialization step: the first validation is as fast as the last.
Object schemas JIT-compile a specialised validator on first use (microseconds),
after which validation is typically 4–7x faster than Zod for objects and up to
48x faster for numbers (see the README benchmarks).

## Troubleshooting

### Error: "Cannot find module 'dhi/schema-nextjs'"

Upgrade to dhi >= 1.6 (which exports both `dhi/nextjs` and the
`dhi/schema-nextjs` alias), or simply import from `'dhi'`.

### Error: "Top-level await is not available"

Upgrade to dhi >= 1.6: no entry point uses top-level await any more.

### `DhiObject.parse()` returns `any`

Fixed in dhi 1.6 — `parse()` / `safeParse()` return the inferred object type.

### MCP SDK: `def.shape is not a function`

Fixed in dhi 1.6 — dhi schemas now expose Zod 4's `_zod` internals, which the
MCP SDK uses for JSON Schema generation and argument validation.

## TypeScript Configuration

Any modern config works; for the best experience:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2020",
    "strict": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  }
}
```
