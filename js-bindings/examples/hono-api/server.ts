/**
 * Hono API Server with dhi Validation
 *
 * This example shows how to use dhi for request validation in a Hono server.
 * dhi provides Zod-compatible API with SIMD-accelerated validation.
 *
 * Run with: bun run server.ts
 */

import { Hono } from 'hono';
import { z } from 'dhi';

// ============================================================
// Schema Definitions (using dhi's Zod-compatible API)
// ============================================================

// User creation schema
const CreateUserSchema = z.object({
  name: z.string().min(1).max(100).describe("User's full name"),
  email: z.string().email().describe("User's email address"),
  age: z.number().int().positive().optional().describe("User's age"),
  role: z.enum(['admin', 'user', 'guest']).default('user').describe("User's role"),
});

// User update schema (all fields optional)
const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  age: z.number().int().positive().optional(),
  role: z.enum(['admin', 'user', 'guest']).optional(),
});

// Query params for listing users
const ListUsersQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
  role: z.enum(['admin', 'user', 'guest']).optional(),
});

// Product schema
const ProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  quantity: z.number().int().nonnegative(),
  tags: z.array(z.string()).optional(),
});

// Order schema with nested validation
const OrderSchema = z.object({
  userId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
  shippingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
    country: z.string().min(2).max(2),
  }),
});

// Type inference from schemas
type CreateUser = z.infer<typeof CreateUserSchema>;
type UpdateUser = z.infer<typeof UpdateUserSchema>;
type Product = z.infer<typeof ProductSchema>;
type Order = z.infer<typeof OrderSchema>;

// ============================================================
// Hono App
// ============================================================

const app = new Hono();

// In-memory "database"
const users: Map<string, CreateUser & { id: string }> = new Map();
const products: Map<string, Product & { id: string }> = new Map();

// ============================================================
// Validation Middleware Helper
// ============================================================

function validateBody<T>(schema: z.ZodType<T>) {
  return async (c: any, next: () => Promise<void>) => {
    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        return c.json({
          error: 'Validation failed',
          issues: result.error.issues,
        }, 400);
      }

      c.set('validatedBody', result.data);
      await next();
    } catch (e) {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
  };
}

function validateQuery<T>(schema: z.ZodType<T>) {
  return async (c: any, next: () => Promise<void>) => {
    const query = c.req.query();
    const result = schema.safeParse(query);

    if (!result.success) {
      return c.json({
        error: 'Invalid query parameters',
        issues: result.error.issues,
      }, 400);
    }

    c.set('validatedQuery', result.data);
    await next();
  };
}

// ============================================================
// Routes
// ============================================================

// Health check
app.get('/', (c) => {
  return c.json({
    message: 'Hono API with dhi validation',
    version: '1.0.0',
    endpoints: [
      'GET /api/users',
      'POST /api/users',
      'GET /api/users/:id',
      'PUT /api/users/:id',
      'DELETE /api/users/:id',
      'POST /api/products',
      'POST /api/orders',
      'GET /api/schema/:name',
    ],
  });
});

// --- Users ---

// List users with query validation
app.get('/api/users', validateQuery(ListUsersQuerySchema), (c) => {
  const query = c.get('validatedQuery');
  const allUsers = Array.from(users.values());

  // Filter by role if specified
  let filtered = query.role
    ? allUsers.filter(u => u.role === query.role)
    : allUsers;

  // Paginate
  const start = (query.page - 1) * query.limit;
  const paginated = filtered.slice(start, start + query.limit);

  return c.json({
    data: paginated,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: filtered.length,
    },
  });
});

// Create user
app.post('/api/users', validateBody(CreateUserSchema), (c) => {
  const body: CreateUser = c.get('validatedBody');
  const id = crypto.randomUUID();

  const user = { id, ...body };
  users.set(id, user);

  return c.json({ data: user }, 201);
});

// Get user by ID
app.get('/api/users/:id', (c) => {
  const id = c.req.param('id');
  const user = users.get(id);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ data: user });
});

// Update user
app.put('/api/users/:id', validateBody(UpdateUserSchema), (c) => {
  const id = c.req.param('id');
  const updates: UpdateUser = c.get('validatedBody');

  const user = users.get(id);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const updated = { ...user, ...updates };
  users.set(id, updated);

  return c.json({ data: updated });
});

// Delete user
app.delete('/api/users/:id', (c) => {
  const id = c.req.param('id');

  if (!users.has(id)) {
    return c.json({ error: 'User not found' }, 404);
  }

  users.delete(id);
  return c.json({ message: 'User deleted' });
});

// --- Products ---

app.post('/api/products', validateBody(ProductSchema), (c) => {
  const body: Product = c.get('validatedBody');
  const id = crypto.randomUUID();

  const product = { id, ...body };
  products.set(id, product);

  return c.json({ data: product }, 201);
});

// --- Orders ---

app.post('/api/orders', validateBody(OrderSchema), (c) => {
  const order: Order = c.get('validatedBody');

  // Verify user exists
  if (!users.has(order.userId)) {
    return c.json({ error: 'User not found' }, 400);
  }

  // In a real app, you'd save to database
  const orderId = crypto.randomUUID();

  return c.json({
    data: {
      id: orderId,
      ...order,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  }, 201);
});

// ============================================================
// JSON Schema Endpoints (for API documentation / OpenAI tools)
// ============================================================

const schemas = {
  'create-user': CreateUserSchema,
  'update-user': UpdateUserSchema,
  'product': ProductSchema,
  'order': OrderSchema,
  'list-users-query': ListUsersQuerySchema,
};

app.get('/api/schema/:name', (c) => {
  const name = c.req.param('name') as keyof typeof schemas;
  const schema = schemas[name];

  if (!schema) {
    return c.json({
      error: 'Schema not found',
      available: Object.keys(schemas),
    }, 404);
  }

  // Use dhi's built-in JSON Schema generation
  // Both .toJsonSchema() and .json() work identically
  return c.json(schema.json());
});

// Get all schemas (useful for OpenAPI generation)
app.get('/api/schemas', (c) => {
  const allSchemas: Record<string, any> = {};

  for (const [name, schema] of Object.entries(schemas)) {
    allSchemas[name] = schema.toJsonSchema();
  }

  return c.json(allSchemas);
});

// ============================================================
// Start Server
// ============================================================

const port = 3000;
console.log(`🚀 Server running at http://localhost:${port}`);
console.log(`📖 API docs: http://localhost:${port}/api/schemas`);

export default {
  port,
  fetch: app.fetch,
};
