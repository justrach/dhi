# dhi + Cloudflare Workers Example

Ultra-fast validation in Cloudflare Workers using dhi (77x faster than Zod).

## Quick Start

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy to Cloudflare
npm run deploy
```

## Performance

Running in Cloudflare Workers with wrangler 4.x:
- **1.4 million validations/second** for complex object schemas
- 28KB WASM bundle size
- Full Zod 4 API compatibility

## WASM Import Options

### Option 1: Explicit `/cloudflare` subpath (Recommended)

```typescript
import { z } from 'dhi/cloudflare';
```

This explicitly uses the Cloudflare Workers-optimized build with direct WASM ES module imports.

### Option 2: Default import with wrangler 4.x

```typescript
import { z } from 'dhi';
```

With **wrangler 4.x**, this also works because dhi uses [conditional exports](https://nodejs.org/api/packages.html#conditional-exports) with `workerd` condition that wrangler resolves correctly.

### Troubleshooting WASM Issues

If you see errors like:
```
Error: readAll '/path/to/node_modules/dhi/.../dhi.wasm' failed
```

This means the bundler is using the Node.js build (which uses `fs.readFileSync`) instead of the Workers build. Solutions:

1. **Upgrade to wrangler 4.x** - older versions may not resolve conditional exports correctly
2. **Use the explicit import** - `import { z } from 'dhi/cloudflare'` always uses the correct build
3. **Check your bundler config** - ensure it respects the `workerd` or `worker` export conditions

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/validate/user` | Validate a user object |
| POST | `/users` | Create a user (with validation) |
| GET | `/users` | List users (with query validation) |
| POST | `/benchmark` | Run validation benchmark |

## Example Requests

### Validate a user

```bash
curl -X POST http://localhost:8787/validate/user \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "test@example.com",
    "name": "Test User",
    "role": "admin"
  }'
```

### Create a user

```bash
curl -X POST http://localhost:8787/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "name": "Alice Smith",
    "role": "user",
    "age": 28
  }'
```

### Validation error example

```bash
curl -X POST http://localhost:8787/validate/user \
  -H "Content-Type: application/json" \
  -d '{
    "id": "not-a-uuid",
    "email": "invalid-email",
    "name": "",
    "role": "superadmin"
  }'
```

### Run benchmark

```bash
curl -X POST http://localhost:8787/benchmark
```

## How It Works

dhi provides multiple builds optimized for different runtimes:

| Build | Import | WASM Loading | Use Case |
|-------|--------|--------------|----------|
| `schema.js` | `dhi` | `fs.readFileSync` | Node.js, Bun |
| `schema-cloudflare.js` | `dhi/cloudflare` | ES module import | Cloudflare Workers |
| `schema-edge.js` | `dhi/edge` | ES module import | Vercel Edge, Deno |
| `schema-nextjs-edge.js` | `dhi/nextjs` | Embedded base64 | Next.js Edge Runtime |

The package.json exports map these correctly:

```json
{
  "exports": {
    ".": {
      "workerd": "./dist/schema-cloudflare.js",
      "worker": "./dist/schema-cloudflare.js",
      "node": "./dist/schema.js",
      "default": "./dist/schema.js"
    },
    "./cloudflare": {
      "import": "./dist/schema-cloudflare.js"
    }
  }
}
```

## Building with Webpack

This example can also be built with webpack (for custom bundling scenarios):

```bash
npm run build:webpack
```

Webpack correctly resolves to `schema-cloudflare.js` via the `conditionNames` config:

```javascript
// webpack.config.cjs
resolve: {
  conditionNames: ['workerd', 'worker', 'import', 'module', 'default'],
}
```

Output:
- `webpack-dist/worker.js` (~50KB)
- `webpack-dist/*.wasm` (27KB)

## Requirements

- Wrangler 4.x+ (recommended)
- Node.js 18+
