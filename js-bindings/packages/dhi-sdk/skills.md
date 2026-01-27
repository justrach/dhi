# dhi-sdk Skills Guide

Quick reference for using dhi-sdk to generate TypeScript SDKs from Hono applications.

## Installation

```bash
# Global install
npm install -g dhi-sdk

# Or use directly with bunx/npx
bunx dhi-sdk generate ./src/api.ts --output ./sdk
```

## Basic Usage

### Generate SDK from Hono App

```bash
# Basic generation
dhi-sdk generate ./src/server.ts --output ./sdk

# With OpenAPI spec
dhi-sdk generate ./src/server.ts --output ./sdk --openapi

# With custom name and base URL
dhi-sdk generate ./src/server.ts --output ./sdk \
  --name myapi \
  --base-url https://api.example.com
```

### Use Generated SDK

```typescript
import { createClient } from './sdk';

const api = createClient({
  baseUrl: 'https://api.example.com',
  headers: {
    'Authorization': 'Bearer your-token',
  },
});

// All methods are fully typed!
const users = await api.users.list();
const user = await api.users.get({ id: '123' });
await api.users.create({ name: 'Alice', email: 'alice@example.com' });
await api.users.update({ id: '123' }, { name: 'Alice Smith' });
await api.users.delete({ id: '123' });
```

## Writing SDK-Friendly Hono Apps

### Basic Routes

```typescript
import { Hono } from 'hono';
import { z } from 'dhi';

const app = new Hono()
  // List all users
  .get('/users', (c) => c.json({ users: [] }))

  // Get single user
  .get('/users/:id', (c) => c.json({ id: c.req.param('id') }))

  // Create user
  .post('/users', (c) => c.json({ id: '123' }, 201))

  // Update user
  .put('/users/:id', (c) => c.json({ updated: true }))

  // Delete user
  .delete('/users/:id', (c) => c.json({ deleted: true }));
```

### With Validation (Recommended)

```typescript
const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user'),
});

const UpdateUserSchema = CreateUserSchema.partial();

// Validation middleware
function validateBody<T>(schema: z.ZodType<T>) {
  return async (c: any, next: () => Promise<void>) => {
    const body = await c.req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }
    c.set('body', result.data);
    await next();
  };
}

app.post('/users', validateBody(CreateUserSchema), (c) => {
  const body = c.get('body');
  return c.json({ id: crypto.randomUUID(), ...body }, 201);
});
```

### Nested Resources

```typescript
// Users → Posts → Comments
app
  .get('/users/:userId/posts', (c) => c.json({ posts: [] }))
  .post('/users/:userId/posts', (c) => c.json({ id: '1' }, 201))
  .get('/users/:userId/posts/:postId', (c) => c.json({ post: {} }))
  .get('/users/:userId/posts/:postId/comments', (c) => c.json({ comments: [] }))
  .post('/users/:userId/posts/:postId/comments', (c) => c.json({ id: '1' }, 201));
```

### Complex Schemas (Discriminated Unions)

```typescript
// Action schemas for state machines
const PostActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('publish') }),
  z.object({ action: z.literal('archive'), reason: z.string() }),
  z.object({ action: z.literal('feature'), position: z.number() }),
]);

app.post('/posts/:id/actions', validateBody(PostActionSchema), (c) => {
  const action = c.get('body');
  return c.json({ success: true, action: action.action });
});
```

## Generated SDK Structure

```
sdk/
├── types.ts      # TypeScript interfaces
├── client.ts     # API client with methods
├── index.ts      # Re-exports
└── openapi.json  # OpenAPI 3.1 spec (if --openapi)
```

### Client Methods

| Route | Generated Method |
|-------|------------------|
| `GET /users` | `api.users.list()` |
| `GET /users/:id` | `api.users.get({ id })` |
| `POST /users` | `api.users.create(body)` |
| `PUT /users/:id` | `api.users.update({ id }, body)` |
| `DELETE /users/:id` | `api.users.delete({ id })` |
| `GET /users/:userId/posts` | `api.users.getPosts({ userId })` |
| `POST /users/:userId/posts/:postId/actions` | `api.users.createActions({ userId, postId }, body)` |

### Error Handling

```typescript
import { createClient, ApiError } from './sdk';

const api = createClient({ baseUrl: '...' });

try {
  const user = await api.users.get({ id: '123' });
} catch (error) {
  if (error instanceof ApiError) {
    console.log(error.status);     // 404
    console.log(error.statusText); // "Not Found"
    console.log(error.body);       // Error response body
  }
}
```

### Custom Fetch

```typescript
// Use custom fetch (e.g., for testing)
const api = createClient({
  baseUrl: 'https://api.example.com',
  fetch: customFetch,
});

// Add request interceptors
const api = createClient({
  baseUrl: 'https://api.example.com',
  fetch: async (url, init) => {
    console.log('Request:', url);
    const response = await fetch(url, init);
    console.log('Response:', response.status);
    return response;
  },
});
```

## Programmatic API

```typescript
import { RouteExtractor, SDKGenerator } from 'dhi-sdk';

// Extract routes
const extractor = new RouteExtractor();
const api = await extractor.extract('./src/server.ts');

console.log(`Found ${api.routes.length} routes`);
for (const route of api.routes) {
  console.log(`${route.method} ${route.path}`);
}

// Generate SDK
const generator = new SDKGenerator(api, {
  input: './src/server.ts',
  output: './sdk',
  name: 'myapi',
  openapi: true,
});

const sdk = generator.generate();

// Write files manually or use the output
console.log(sdk.client);  // Generated client code
console.log(sdk.types);   // Generated types
console.log(sdk.openapi); // OpenAPI spec object
```

## Best Practices

### 1. Consistent Path Naming

```typescript
// Good: RESTful, consistent
app.get('/users', ...)
app.get('/users/:id', ...)
app.post('/users', ...)
app.put('/users/:id', ...)

// Avoid: Inconsistent naming
app.get('/getUsers', ...)
app.post('/createUser', ...)
```

### 2. Use Schemas for All Bodies

```typescript
// Good: Schema defined
app.post('/users', validateBody(CreateUserSchema), handler);

// Less ideal: No schema (types won't be generated)
app.post('/users', handler);
```

### 3. Return Consistent Response Shapes

```typescript
// Good: Consistent wrapper
app.get('/users', (c) => c.json({ data: users, total: 100 }));
app.get('/users/:id', (c) => c.json({ data: user }));

// Avoid: Inconsistent shapes
app.get('/users', (c) => c.json(users));
app.get('/users/:id', (c) => c.json({ user }));
```

### 4. Group Related Routes

```typescript
// Good: Logically grouped
const userRoutes = new Hono()
  .get('/', listUsers)
  .post('/', createUser)
  .get('/:id', getUser);

app.route('/users', userRoutes);
```

## Troubleshooting

### Routes Not Detected

- Ensure paths start with `/`
- Check that route methods are `.get()`, `.post()`, etc. (not custom)
- Verify the file compiles without TypeScript errors

### Types Not Generated

- Add validation schemas using `validateBody()` or similar
- Export schemas at module level for better detection

### OpenAPI Missing Details

- Add `.describe()` to schema fields
- Use explicit response types where possible
