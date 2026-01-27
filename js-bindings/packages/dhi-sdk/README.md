# dhi-sdk

Generate TypeScript SDKs from Hono + dhi apps. Like [Stainless](https://stainlessapi.com/) or [Fern](https://buildwithfern.com/), but **code-first**.

> **No separate API spec to maintain.** Your Hono code IS the source of truth.

## Quick Start

```bash
# Install
npm install -g dhi-sdk
# or
bunx dhi-sdk

# Generate SDK from your Hono app
dhi-sdk generate ./src/api.ts --output ./sdk
```

## Usage

### CLI

```bash
# Basic generation
dhi-sdk generate ./src/api.ts --output ./sdk

# With OpenAPI spec
dhi-sdk generate ./src/api.ts --output ./sdk --openapi

# With custom name and base URL
dhi-sdk generate ./src/api.ts --output ./sdk --name myapi --base-url https://api.example.com
```

### Generated SDK

```typescript
import { createClient } from './sdk';

const api = createClient({
  baseUrl: 'https://api.example.com',
  headers: {
    'Authorization': 'Bearer token',
  },
});

// Fully typed!
const user = await api.users.create({
  name: 'Alice',
  email: 'alice@example.com',
});

const users = await api.users.list({ page: 1, limit: 10 });

const specificUser = await api.users.get({ id: '123' });
```

### Programmatic API

```typescript
import { RouteExtractor, SDKGenerator } from 'dhi-sdk';

const extractor = new RouteExtractor();
const api = await extractor.extract('./src/api.ts');

const generator = new SDKGenerator(api, {
  input: './src/api.ts',
  output: './sdk',
  name: 'myapi',
  openapi: true,
});

const sdk = generator.generate();
// sdk.types - TypeScript type definitions
// sdk.client - API client code
// sdk.index - Exports
// sdk.openapi - OpenAPI 3.1 spec
```

## How It Works

dhi-sdk uses TypeScript AST analysis to extract:

1. **Route definitions** from Hono's `.get()`, `.post()`, `.put()`, `.patch()`, `.delete()`
2. **Validation schemas** from dhi/Zod validators
3. **Path parameters** from route patterns like `/users/:id`
4. **Response types** from `c.json()` calls

### Input: Hono App

```typescript
import { Hono } from 'hono';
import { z } from 'dhi';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const app = new Hono()
  .post('/users', validateBody(CreateUserSchema), (c) => {
    const user = c.get('validatedBody');
    return c.json({ id: '123', ...user }, 201);
  })
  .get('/users/:id', (c) => {
    return c.json({ id: c.req.param('id'), name: 'Alice' });
  });
```

### Output: Generated SDK

```typescript
// types.ts
export interface UsersPostRequest {
  name: string;
  email: string;
}

export interface UsersGetParams {
  id: string;
}

// client.ts
export function createClient(config: ClientConfig) {
  return {
    users: {
      async create(body: UsersPostRequest, options?: RequestOptions) {
        return request('POST', '/users', { body, ...options });
      },
      async get(params: UsersGetParams, options?: RequestOptions) {
        return request('GET', `/users/${params.id}`, { ...options });
      },
    },
  };
}
```

## Generated Files

| File | Description |
|------|-------------|
| `types.ts` | TypeScript interfaces from dhi schemas |
| `client.ts` | Fetch-based API client |
| `index.ts` | Re-exports |
| `openapi.json` | OpenAPI 3.1 spec (if `--openapi`) |

## Comparison

| Feature | Stainless | Fern | dhi-sdk |
|---------|-----------|------|---------|
| Input | OpenAPI | OpenAPI/DSL | **Hono + dhi code** |
| Spec maintenance | Required | Required | **Not needed** |
| Type safety | Generated | Generated | **Source of truth** |
| Languages | Multiple | Multiple | TypeScript |
| Validation | External | External | **Built-in (dhi)** |

## Roadmap

- [ ] Better schema extraction (full AST analysis)
- [ ] Request body type extraction
- [ ] Response type inference
- [ ] Support for Hono's built-in validators
- [ ] Watch mode for development
- [ ] Multi-file support

## License

MIT
