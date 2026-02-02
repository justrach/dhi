/**
 * dhi Cloudflare Workers Example
 *
 * This example demonstrates using dhi for ultra-fast validation in Cloudflare Workers.
 * dhi is 77x faster than Zod with full Zod 4 API compatibility.
 *
 * Import Options:
 * 1. `import { z } from 'dhi/cloudflare'` - Explicit Cloudflare build (recommended)
 * 2. `import { z } from 'dhi'` - Also works with wrangler 4.x (uses conditional exports)
 */

// Using explicit /cloudflare subpath for maximum compatibility
// This ensures the correct WASM loading strategy regardless of bundler
import { z } from 'dhi/cloudflare';

// ============================================================================
// SCHEMAS - Define your validation schemas (Zod 4 compatible API)
// ============================================================================

// User schema with various validations
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().positive().max(150).optional(),
  role: z.enum(['admin', 'user', 'guest']),
  tags: z.array(z.string()).max(10).optional(),
  createdAt: z.string().datetime().optional(),
});

type User = z.infer<typeof UserSchema>;

// API request body schema
const CreateUserBodySchema = UserSchema.omit({ id: true, createdAt: true });

// Query params schema (with coercion for URL params)
const ListUsersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  role: z.enum(['admin', 'user', 'guest']).optional(),
});

// ============================================================================
// WORKER HANDLER
// ============================================================================

export interface Env {
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for API
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route: GET / - Health check
      if (path === '/' && request.method === 'GET') {
        return Response.json(
          {
            status: 'ok',
            message: 'dhi Cloudflare Workers example',
            environment: env.ENVIRONMENT,
          },
          { headers: corsHeaders }
        );
      }

      // Route: POST /validate/user - Validate a user object
      if (path === '/validate/user' && request.method === 'POST') {
        const body = await request.json();
        const result = UserSchema.safeParse(body);

        if (!result.success) {
          return Response.json(
            {
              valid: false,
              errors: result.error.format(),
            },
            { status: 400, headers: corsHeaders }
          );
        }

        return Response.json(
          {
            valid: true,
            data: result.data,
          },
          { headers: corsHeaders }
        );
      }

      // Route: POST /users - Create a user (validates body)
      if (path === '/users' && request.method === 'POST') {
        const body = await request.json();
        const result = CreateUserBodySchema.safeParse(body);

        if (!result.success) {
          return Response.json(
            {
              error: 'Validation failed',
              details: result.error.format(),
            },
            { status: 400, headers: corsHeaders }
          );
        }

        // Create user with generated ID and timestamp
        const user: User = {
          id: crypto.randomUUID(),
          ...result.data,
          createdAt: new Date().toISOString(),
        };

        return Response.json(
          {
            message: 'User created',
            user,
          },
          { status: 201, headers: corsHeaders }
        );
      }

      // Route: GET /users - List users (validates query params)
      if (path === '/users' && request.method === 'GET') {
        const params = Object.fromEntries(url.searchParams);
        const result = ListUsersQuerySchema.safeParse(params);

        if (!result.success) {
          return Response.json(
            {
              error: 'Invalid query parameters',
              details: result.error.format(),
            },
            { status: 400, headers: corsHeaders }
          );
        }

        // Return mock data (in production, query a database)
        return Response.json(
          {
            params: result.data,
            users: [
              {
                id: '550e8400-e29b-41d4-a716-446655440001',
                email: 'alice@example.com',
                name: 'Alice',
                role: 'admin',
              },
              {
                id: '550e8400-e29b-41d4-a716-446655440002',
                email: 'bob@example.com',
                name: 'Bob',
                role: 'user',
              },
            ],
          },
          { headers: corsHeaders }
        );
      }

      // Route: POST /benchmark - Quick validation benchmark
      if (path === '/benchmark' && request.method === 'POST') {
        const iterations = 10000;
        const testData = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'test@example.com',
          name: 'Test User',
          age: 25,
          role: 'user' as const,
          tags: ['developer', 'typescript'],
        };

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
          UserSchema.parse(testData);
        }
        const end = performance.now();

        const duration = end - start;
        const opsPerSec = Math.round((iterations / duration) * 1000);

        return Response.json(
          {
            iterations,
            durationMs: duration.toFixed(2),
            opsPerSecond: opsPerSec,
            message: `dhi validated ${iterations} objects in ${duration.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`,
          },
          { headers: corsHeaders }
        );
      }

      // 404 for unknown routes
      return Response.json(
        {
          error: 'Not found',
          availableRoutes: [
            'GET /',
            'POST /validate/user',
            'POST /users',
            'GET /users',
            'POST /benchmark',
          ],
        },
        { status: 404, headers: corsHeaders }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return Response.json(
        { error: message },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
