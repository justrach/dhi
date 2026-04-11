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

# Use config file
ts-to-dhi -c ts-to-dhi.json
```

## Supported Features

### TypeScript Types

| TypeScript | dhi Output |
|------------|------------|
| `interface` | `z.object()` |
| `type` (object literal) | `z.object()` |
| `string`, `number`, `boolean` | `z.string()`, etc. |
| `T?` (optional) | `.optional()` |
| `T \| null` | `.nullable()` |
| `"a" \| "b"` | `z.enum([...])` |
| `T[]` | `z.array(...)` |
| `[T, U]` | `z.tuple(...)` |
| `A & B` | `z.intersection(...)` |
| `Record<K, V>` | `z.record(...)` |
| `any` | `z.any()` |

### JSDoc Validators

Add validation constraints via JSDoc comments:

```typescript
interface User {
  /** @minimum 0 @maximum 150 */
  age: number;
  
  /** @minLength 2 @maxLength 50 */
  name: string;
  
  /** @format email */
  email: string;
  
  /** @pattern ^[A-Z]{2}$ */
  countryCode: string;
  
  /** @default "user" */
  role?: string;
}
```

Generated:
```typescript
export const UserSchema = z.object({
  age: z.number().min(0).max(150),
  name: z.string().min(2).max(50),
  email: z.string().email(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  role: z.string().default("user").optional(),
});
```

**Supported JSDoc tags:**
- `@minimum {number}` - Number minimum (uses `.min()`)
- `@maximum {number}` - Number maximum (uses `.max()`)
- `@minLength {number}` - String minimum length
- `@maxLength {number}` - String maximum length
- `@format {type}` - String format (`email`, `uuid`, `url`)
- `@pattern {regex}` - String regex pattern
- `@default {value}` - Default value

### Cross-File Imports

Imported types are handled as external references:

```typescript
// types.ts
import { Address } from "./address";

export interface User {
  name: string;
  address: Address;
}
```

Generated:
```typescript
// External types (will use z.any() as placeholder)
const AddressSchema = z.any(); // From: ./address

export const UserSchema = z.object({
  name: z.string(),
  address: AddressSchema,
});
```

## Config File

Create `ts-to-dhi.json` for repeated use:

```json
{
  "input": "src/types.ts",
  "output": "src/schemas.ts"
}
```

## Programmatic API

```typescript
import { extractTypes, generateDhiSchema } from '@dhi/ts-to-dhi';

const source = `interface User { name: string; }`;
const { types, imports } = extractTypes(source);
const code = generateDhiSchema(types, imports);
```

## Parser

Powered by [oxc-parser](https://www.npmjs.com/package/oxc-parser) — a Rust-based TypeScript parser compiled to WebAssembly. Fast and accurate.

## Comparison

| Feature | ts-to-zod | ts-to-dhi |
|---------|-----------|-----------|
| Target | Zod | dhi (77x faster) |
| JSDoc validators | ✅ Advanced | ✅ Basic |
| Tuples | ❌ | ✅ |
| Intersections | ❌ | ✅ |
| Speed | Medium | **Very fast** |
