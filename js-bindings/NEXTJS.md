# Using dhi with Next.js

Complete guide for integrating dhi (the fastest TypeScript validation library) with Next.js.

## Quick Start

### 1. Install

```bash
npm install dhi
# or
pnpm add dhi
# or
yarn add dhi
```

### 2. Use Next.js-Compatible Import

```typescript
// ✅ Use this import for Next.js
import { z } from 'dhi/schema-nextjs';

// ❌ Don't use this in Next.js (uses top-level await)
import { z } from 'dhi/schema';
```

### 3. Configure Next.js (Optional)

Add WASM support to `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    return config;
  },
};

module.exports = nextConfig;
```

## Usage Examples

### Client Component

```typescript
'use client';

import { useState } from 'react';
import { z } from 'dhi/schema-nextjs';

const UserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().positive().int(),
}).strict();

export default function UserForm() {
  const [result, setResult] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 25,
    };

    try {
      // Async validation (WASM loads on first call)
      const user = await UserSchema.parse(formData);
      setResult(`Valid: ${JSON.stringify(user)}`);
    } catch (error) {
      setResult(`Invalid: ${error}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Your form fields */}
      <button type="submit">Validate</button>
      <pre>{result}</pre>
    </form>
  );
}
```

### Server Component (App Router)

```typescript
import { z } from 'dhi/schema-nextjs';

const PostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  published: z.boolean(),
});

export default async function PostPage({ params }: { params: { id: string } }) {
  const postData = await fetch(`https://api.example.com/posts/${params.id}`);
  const post = await postData.json();

  try {
    // Validate server-side
    const validPost = await PostSchema.parse(post);
    
    return (
      <article>
        <h1>{validPost.title}</h1>
        <p>{validPost.content}</p>
      </article>
    );
  } catch (error) {
    return <div>Invalid post data</div>;
  }
}
```

### API Route (App Router)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'dhi/schema-nextjs';

const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().positive().int(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validData = await CreateUserSchema.parse(body);
    
    // Process valid data...
    // await db.users.create(validData);
    
    return NextResponse.json({ success: true, user: validData });
  } catch (error) {
    return NextResponse.json(
      { error: 'Validation failed', details: String(error) },
      { status: 400 }
    );
  }
}
```

### Server Action

```typescript
'use server';

import { z } from 'dhi/schema-nextjs';
import { revalidatePath } from 'next/cache';

const FormSchema = z.object({
  email: z.string().email(),
  message: z.string().min(10).max(1000),
});

export async function submitContactForm(formData: FormData) {
  const data = {
    email: formData.get('email'),
    message: formData.get('message'),
  };

  try {
    const validData = await FormSchema.parse(data);
    
    // Process form...
    // await sendEmail(validData);
    
    revalidatePath('/contact');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

### Middleware (Edge Runtime)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'dhi/schema-nextjs';

const ApiKeySchema = z.object({
  'x-api-key': z.string().length(32),
});

export async function middleware(request: NextRequest) {
  const headers = {
    'x-api-key': request.headers.get('x-api-key') || '',
  };

  try {
    await ApiKeySchema.parse(headers);
    return NextResponse.next();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: '/api/:path*',
};
```

## Key Differences from Regular dhi

### ✅ Next.js-Compatible (`dhi/schema-nextjs`)

- ✅ Async validation: `await schema.parse(data)`
- ✅ Lazy WASM loading
- ✅ Works in Node.js, Edge Runtime, and Browser
- ✅ No top-level await
- ✅ Compatible with Turbopack and Webpack

### ❌ Regular dhi (`dhi/schema`)

- ❌ Top-level `await` breaks Next.js builds
- ❌ Uses `import.meta.dir` (not portable)
- ❌ Uses `fs.readFileSync` (doesn't work in Edge)
- ⚠️ Only use in non-Next.js projects (Node.js scripts, etc.)

## API Differences

| Feature | `dhi/schema` | `dhi/schema-nextjs` |
|---------|-------------|---------------------|
| **Validation** | `schema.parse(data)` | `await schema.parse(data)` |
| **Safe Parse** | `schema.safeParse(data)` | `await schema.safeParse(data)` |
| **WASM Loading** | Synchronous (top-level) | Async (lazy) |
| **Initialization** | Automatic | Automatic (lazy) or manual `await init()` |
| **Performance** | Same | Same after WASM loads |

## Performance

**After WASM loads (cached), performance is identical:**

- **parseSafe**: 7.02M ops/s (3.37x faster than Zod)
- **parseStrict**: 1.46M ops/s (1.11x faster than Zod)
- **Average**: 1.78x faster than Zod

**First validation** adds ~10-20ms for WASM initialization (one-time cost).

## Manual Initialization (Optional)

Pre-load WASM to avoid delay on first validation:

```typescript
import { z, init } from 'dhi/schema-nextjs';

// Pre-load WASM (optional)
await init();

// Now validations are instant
const result = await schema.parse(data);
```

## Troubleshooting

### Error: "Cannot find module 'dhi/schema-nextjs'"

**Solution**: Update `package.json` in dhi package to include exports:

```json
{
  "exports": {
    "./schema": "./schema.js",
    "./schema-nextjs": "./schema-nextjs.js",
    "./turbo": "./schema-turbo.js"
  }
}
```

### Error: "Top-level await is not available"

**Solution**: Make sure you're using `dhi/schema-nextjs`, not `dhi/schema`.

```typescript
// ✅ Correct
import { z } from 'dhi/schema-nextjs';

// ❌ Wrong
import { z } from 'dhi/schema';
```

### WASM not loading in Edge Runtime

**Solution**: Ensure `next.config.js` has WASM support:

```javascript
config.experiments = {
  asyncWebAssembly: true,
};
```

### Slow first validation

**Solution**: Pre-initialize WASM in layout or middleware:

```typescript
import { init } from 'dhi/schema-nextjs';

// In layout.tsx or middleware
await init();
```

## TypeScript Configuration

Add to `tsconfig.json` for best experience:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  }
}
```

## Vercel Deployment

Works out-of-the-box on Vercel! No additional configuration needed.

**Supported runtimes:**
- ✅ Node.js runtime
- ✅ Edge runtime
- ✅ Serverless functions

## Example App

See `examples/nextjs-app/` for a complete working example with:
- Client-side form validation
- Server-side API validation
- Server actions
- Tailwind CSS styling

**Run the example:**

```bash
cd examples/nextjs-app
npm install
npm run dev
```

Visit `http://localhost:3000` to see it in action!

## Comparison with Zod

### Migration from Zod

**Before (Zod):**
```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  age: z.number().positive(),
});

const result = schema.safeParse(data);
```

**After (dhi):**
```typescript
import { z } from 'dhi/schema-nextjs';

const schema = z.object({
  email: z.string().email(),
  age: z.number().positive(),
});

const result = await schema.safeParse(data); // Just add 'await'!
```

### Performance Gains

| Test | Zod | dhi | Speedup |
|------|-----|-----|---------|
| Simple object | 2.08M ops/s | 7.02M ops/s | **3.37x** |
| Strict validation | 1.31M ops/s | 1.46M ops/s | **1.11x** |
| Complex nested | 0.85M ops/s | 1.45M ops/s | **1.71x** |

## Best Practices

### 1. Pre-initialize in App Layout

```typescript
// app/layout.tsx
import { init } from 'dhi/schema-nextjs';

export default async function RootLayout({ children }) {
  await init(); // Load WASM once for all pages
  
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

### 2. Reuse Schemas

```typescript
// lib/schemas.ts
import { z } from 'dhi/schema-nextjs';

export const UserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

// Use in multiple places
import { UserSchema } from '@/lib/schemas';
```

### 3. Handle Errors Gracefully

```typescript
try {
  const data = await schema.parse(input);
  // Success
} catch (error) {
  // Validation failed
  console.error('Validation error:', error);
  // Show user-friendly error
}
```

## Limitations

### No Sync API

Since WASM loading is async, there's no synchronous `parseSync()` equivalent. Always use `await`.

```typescript
// ❌ Not available
const result = schema.parseSync(data);

// ✅ Use async
const result = await schema.parse(data);
```

### First Validation Latency

First validation adds ~10-20ms for WASM initialization. Pre-initialize if this matters:

```typescript
await init(); // One-time cost
```

## Support

- **GitHub**: https://github.com/justrach/dhi
- **npm**: https://www.npmjs.com/package/dhi
- **Issues**: https://github.com/justrach/dhi/issues

## License

MIT - Free to use in commercial and open-source projects.

---

**dhi + Next.js**: The fastest way to validate data in Next.js applications! 🚀
