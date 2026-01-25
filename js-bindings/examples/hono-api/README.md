# Hono API with dhi Validation

A complete REST API example using [Hono](https://hono.dev) with [dhi](https://www.npmjs.com/package/dhi) for request validation.

## Features

- 🚀 **Fast validation** - dhi's SIMD-accelerated validators
- 🎯 **Type-safe** - Full TypeScript inference from schemas
- 📝 **JSON Schema** - Auto-generate schemas for API docs
- 🔌 **Zod-compatible** - Same API you already know

## Quick Start

```bash
# Install dependencies
bun install

# Start server
bun run dev

# Run tests (in another terminal)
bun run test
```

## API Endpoints

### Users
- `GET /api/users` - List users (with pagination & filtering)
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Products
- `POST /api/products` - Create product

### Orders
- `POST /api/orders` - Create order (with nested validation)

### Schemas
- `GET /api/schema/:name` - Get JSON Schema for a schema
- `GET /api/schemas` - Get all JSON Schemas

## Example Requests

### Create User
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com", "role": "admin"}'
```

### Create Order (Nested Validation)
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-here",
    "items": [{"productId": "prod-1", "quantity": 2}],
    "shippingAddress": {
      "street": "123 Main St",
      "city": "San Francisco",
      "zipCode": "94102",
      "country": "US"
    }
  }'
```

### Get JSON Schema (for OpenAI tools, etc.)
```bash
curl http://localhost:3000/api/schema/create-user
```

## Validation Examples

```typescript
import { z } from 'dhi';

// Define schema
const UserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

// Validate
const result = UserSchema.safeParse(data);
if (!result.success) {
  // Handle validation errors
  console.log(result.error.issues);
}

// Get JSON Schema
const jsonSchema = UserSchema.toJsonSchema();
```

## Why dhi?

| Feature | dhi | Zod |
|---------|-----|-----|
| Performance | 46M validations/sec | 0.6M validations/sec |
| Bundle size | 28KB (WASM) | ~50KB |
| JSON Schema | Built-in | Requires zod-to-json-schema |
| API | Zod 4 compatible | - |
