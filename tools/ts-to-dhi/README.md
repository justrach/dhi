# @dhi/ts-to-dhi

Generate dhi validation schemas from TypeScript types.

## What it does

Turns your TypeScript types into runtime validation schemas:

```typescript
// Input: types.ts
interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  role: "admin" | "user";
  tags: string[];
}

// Output: types.schemas.ts (auto-generated!)
export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  age: z.number().optional(),
  role: z.enum(["admin", "user"]),
  tags: z.array(z.string()),
});

export type User = z.infer<typeof UserSchema>;
```

## Why use it?

TypeScript types disappear at runtime. But you often need to validate:
- API request bodies
- Form inputs
- Config files
- External data

**Without ts-to-dhi:** You manually write dhi schemas. They get out of sync with your types.

**With ts-to-dhi:** Schemas are auto-generated. Always in sync.

## Install

```bash
npm install -g @dhi/ts-to-dhi
# or
npx @dhi/ts-to-dhi types.ts
```

## Usage

```bash
# Generate schemas (types.ts → types.schemas.ts)
ts-to-dhi types.ts

# Custom output file
ts-to-dhi types.ts -o schemas.ts

# Watch mode (regenerate on changes)
ts-to-dhi types.ts -w
```

## Supported Features

| TypeScript | dhi Output |
|------------|------------|
| `interface` | `z.object()` |
| `type` (object literal) | `z.object()` |
| `string`, `number`, `boolean` | `z.string()`, etc. |
| `T?` (optional) | `.optional()` |
| `T \| null` | `.nullable()` |
| `"a" \| "b"` | `z.enum([...])` |
| `T[]` | `z.array(...)` |
| `Record<K, V>` | `z.record(...)` |
| `any` | `z.any()` |

## Programmatic API

```typescript
import { extractTypes, generateDhiSchema } from '@dhi/ts-to-dhi';

const source = `interface User { name: string; }`;
const types = extractTypes(source);
const code = generateDhiSchema(types);
```

## Parser

Powered by [oxc-parser](https://www.npmjs.com/package/oxc-parser) — a Rust-based TypeScript parser compiled to WebAssembly. Fast and accurate.
