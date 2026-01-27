/**
 * Edge Runtime API Route - Tests dhi WASM in Next.js Edge Runtime
 * Uses dhi/edge for optimized WASM validation
 */
import { z } from 'dhi/nextjs';

export const runtime = 'edge';

// Schema with WASM-accelerated validations
const UserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().positive().max(150),
  website: z.string().url().optional(),
  id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate with dhi (WASM-powered, sync API)
    const result = UserSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error.format() },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      data: result.data,
      runtime: 'edge',
      validatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Simple health check with a quick validation
  const testData = {
    name: 'Test User',
    email: 'test@example.com',
    age: 25,
  };

  const result = UserSchema.safeParse(testData);

  return Response.json({
    status: 'ok',
    runtime: 'edge',
    wasmWorking: result.success,
    validated: result.success ? result.data : null,
  });
}
