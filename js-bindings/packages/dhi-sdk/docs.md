# dhi-sdk: How It Works

This document explains the internals of dhi-sdk - a code-first SDK generator for Hono + dhi applications.

## Overview

dhi-sdk transforms your Hono API code into a fully-typed TypeScript SDK. Unlike tools like Stainless or Fern that require maintaining a separate OpenAPI spec, dhi-sdk uses your actual code as the source of truth.

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   Hono + dhi App        │         │   Generated SDK         │
│                         │         │                         │
│   app.post('/users',    │  ───►   │   api.users.create()    │
│     validateBody(z...)) │         │   api.users.get({ id }) │
│   app.get('/users/:id') │         │   api.users.list()      │
│                         │         │                         │
│   + dhi schemas         │         │   + TypeScript types    │
│                         │         │   + OpenAPI spec        │
└─────────────────────────┘         └─────────────────────────┘
```

## Architecture

### 1. Route Extractor (`src/extractor.ts`)

The extractor uses [ts-morph](https://ts-morph.com/) to parse TypeScript AST and find route definitions.

```typescript
// What it looks for:
app.get('/users/:id', ...)    // GET route with path param
app.post('/users', ...)       // POST route
app.put('/users/:id', ...)    // PUT route
app.delete('/users/:id', ...) // DELETE route
```

**How it works:**

1. **Load source file** - ts-morph creates a TypeScript AST
2. **Find call expressions** - Look for `.get()`, `.post()`, `.put()`, `.patch()`, `.delete()` calls
3. **Extract route info**:
   - Path (first string argument)
   - HTTP method (from call name)
   - Path parameters (`:param` patterns)
   - Validation schemas (from middleware)
   - Response types (from `c.json()` calls)

```typescript
// Example extraction
const call = app.get('/users/:id', handler);

// Extracted:
{
  method: 'GET',
  path: '/users/:id',
  pathParams: ['id'],
  bodySchema: undefined,
  querySchema: undefined,
  responseSchema: { ... }
}
```

### 2. SDK Generator (`src/generator.ts`)

The generator takes extracted routes and produces TypeScript code.

**Generated files:**

| File | Purpose |
|------|---------|
| `types.ts` | TypeScript interfaces from schemas |
| `client.ts` | Fetch-based API client |
| `index.ts` | Re-exports |
| `openapi.json` | OpenAPI 3.1 specification |

**Client structure:**

```typescript
// Routes are grouped by first path segment
return {
  users: {
    list(),      // GET /users
    get(),       // GET /users/:id
    create(),    // POST /users
    update(),    // PUT /users/:id
    delete(),    // DELETE /users/:id
  },
  posts: { ... },
  auth: { ... },
};
```

### 3. CLI (`src/cli.ts`)

Command-line interface using [Commander.js](https://github.com/tj/commander.js/).

```bash
dhi-sdk generate <input> [options]

Options:
  -o, --output <dir>     Output directory (default: ./sdk)
  -n, --name <name>      SDK name (default: api)
  --openapi              Generate OpenAPI spec
  --base-url <url>       Base URL for client
```

## Key Algorithms

### Route Path Parsing

```typescript
// Input: '/users/:userId/posts/:postId'
// Output: ['userId', 'postId']

function extractPathParams(path: string): string[] {
  const params: string[] = [];
  const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match;
  while ((match = regex.exec(path)) !== null) {
    params.push(match[1]);
  }
  return params;
}
```

### Resource Grouping

Routes are grouped by their first path segment:

```typescript
// /users          → users.list()
// /users/:id      → users.get()
// /users/:id/posts → users.getPosts()
// /auth/login     → auth.createLogin()
// /webhooks       → webhooks.list()
```

### Method Naming

HTTP methods map to action names:

| HTTP | Single Resource | Collection |
|------|-----------------|------------|
| GET | `get` | `list` |
| POST | - | `create` |
| PUT | `update` | - |
| PATCH | `patch` | - |
| DELETE | `delete` | - |

## Schema Extraction (WIP)

Currently extracts basic schema info from dhi/Zod validators:

```typescript
// Detected patterns:
z.object({ ... })           // Object schema
z.string().email()          // String with constraints
z.number().int().positive() // Number with constraints
z.enum(['a', 'b', 'c'])     // Enum
z.array(z.string())         // Array
z.discriminatedUnion(...)   // Discriminated union
```

## OpenAPI Generation

Generates OpenAPI 3.1 spec from extracted routes:

```json
{
  "openapi": "3.1.0",
  "paths": {
    "/users/{id}": {
      "get": {
        "operationId": "getUsers",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": { "type": "string" }
          }
        ]
      }
    }
  }
}
```

## Limitations & Future Work

### Current Limitations

1. **Schema extraction** - Only basic type inference, not full schema details
2. **Request bodies** - Not yet extracting body schemas from validators
3. **Response types** - Limited inference from `c.json()` calls
4. **Multi-file** - Only single file input supported

### Planned Improvements

- [ ] Full schema extraction from `validateBody(Schema)`
- [ ] Response type inference
- [ ] Multi-file support with route composition
- [ ] Watch mode for development
- [ ] Plugin system for custom frameworks
- [ ] Better nested resource naming

## Example: Full Pipeline

**Input: `server.ts`**
```typescript
import { Hono } from 'hono';
import { z } from 'dhi';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const app = new Hono()
  .get('/users', (c) => c.json({ users: [] }))
  .post('/users', validateBody(CreateUserSchema), (c) => {
    return c.json({ id: '123', ...c.get('body') }, 201);
  })
  .get('/users/:id', (c) => {
    return c.json({ id: c.req.param('id') });
  });
```

**Output: `sdk/client.ts`**
```typescript
export function createClient(config: ClientConfig) {
  return {
    users: {
      async list(options?: RequestOptions) {
        return request('GET', '/users', options);
      },
      async create(body: CreateUserRequest, options?: RequestOptions) {
        return request('POST', '/users', { body, ...options });
      },
      async get(params: { id: string }, options?: RequestOptions) {
        return request('GET', `/users/${params.id}`, options);
      },
    },
  };
}
```

## Contributing

The codebase is structured for easy extension:

```
src/
├── types.ts      # Type definitions
├── extractor.ts  # Route extraction (add framework support here)
├── generator.ts  # Code generation (add output formats here)
├── cli.ts        # CLI interface
└── index.ts      # Public API
```

To add support for a new framework:
1. Create a new extractor class
2. Implement the `extract(filePath)` method
3. Return the same `ExtractedAPI` structure
