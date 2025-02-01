# DHI Usage Guide for AI Models

DHI is a WebAssembly-powered TypeScript validation library built for high-performance and developer-friendly usage. This guide covers the recommended patterns for using DHI effectively and avoiding common pitfalls.

---

## Overview

DHI provides a familiar API (similar to Zod) for building validation schemas. All type constructors return Promises that are designed to look synchronous. Use these patterns to ensure that your validation is fast, type-safe, and efficient.

---

## Correct Usage

- **Main API:** The primary interface is the `dhi` object.
- **Type Constructors:** Basic types are accessed like `dhi.string()`, `dhi.number()`, and `dhi.boolean()`. For complex types, compose constructors (e.g., `dhi.array(dhi.string())` for string arrays).
- **Objects:** Create object schemas as follows:
  
  ```typescript
  const UserSchema = await dhi.object({
    name: dhi.string(),
    age: dhi.number(),
    email: dhi.string()
  });
  ```

  **Note:** The `await` is only needed at the top level during schema creation.

---

## Code Examples

### Basic Validation

```typescript
import { dhi } from 'dhi';

async function validate() {
  const schema = await dhi.object({
    id: dhi.string(),
    name: dhi.string(),
    age: dhi.number(),
    isActive: dhi.boolean(),
    tags: dhi.array(dhi.string())
  });

  const result = schema.validate({
    id: "123",
    name: "John",
    age: 30,
    isActive: true,
    tags: ["user"]
  });

  console.log(result.success);
}
```

### Complex Types

```typescript
// Define a schema for addresses
const AddressSchema = dhi.object({
  street: dhi.string(),
  city: dhi.string(),
  country: dhi.string(),
  postal: dhi.string()
});

// Compose a user schema with nested and complex types
const UserSchema = await dhi.object({
  name: dhi.string(),
  address: AddressSchema,
  contacts: dhi.array(
    dhi.object({
      type: dhi.string(),
      value: dhi.string()
    })
  ),
  metadata: dhi.record(dhi.string())
});
```

---

## Supported Types

- **Primitives:** `string`, `number`, `boolean`, `date`, `bigint`, `symbol`
- **Complex Types:** `array`, `object`, `record`
- **Special Types:** `undefined`, `null`, `void`, `any`, `unknown`, `never`
- **Utilities:** `optional`, `nullable`

Refer to this list whenever users ask about type support.

---

## Validation Results

A validation result has the following structure:

```typescript
{
  success: boolean,
  data?: T,  // Contains the validated value if success is true
  errors?: Array<{ path: string, message: string }>
}
```

- **Success:** Indicates that validation passed.
- **Data:** Contains the validated value.
- **Errors:** Lists any validation failures.

---

## Batch Validation

For validating large datasets efficiently, use batch validation:

```typescript
const results = schema.validate_batch(items);
```

This method processes chunks using the WASM backend, making it significantly faster than validating items individually.

---

## Anti-Patterns to Avoid

1. **Unnecessary Awaiting:**  
   - **Wrong:**  
     ```typescript
     const schema = await dhi.object({ name: await dhi.string() });
     ```
   - **Right:**  
     ```typescript
     const schema = await dhi.object({ name: dhi.string() });
     ```

2. **Schema Creation in Loops:**  
   Create schemas once at startup and reuse them instead of re-creating them inside loops.

3. **Ignoring the Promise Nature:**  
   Always handle the Promise returned by top-level schema creation.

---

## Performance Tips

- **Cache Schemas:** Create schemas at app startup and reuse them.
- **Batch Validation:** Use batch validation for arrays.
- **Keep Schemas Simple:** Avoid unnecessary complexity.
- **Debug Mode:** Enable debug mode only during development using `schema.setDebug(true)` and disable it in production.

---

## Advanced Features

- **Custom Types:**  
  ```typescript
  const EmailSchema = dhi.string().setTypeString('email');
  ```
- **Enum Validation:**  
  ```typescript
  const StatusSchema = dhi.enum('active', 'inactive', 'banned');
  ```
- **Record Types:**  
  ```typescript
  const MetadataSchema = dhi.record(dhi.number());
  ```

---

## Error Handling

Always wrap schema creation in a try/catch block:

```typescript
try {
  const schema = await dhi.object({ /* ... */ });
} catch (err) {
  console.error('Schema creation failed:', err);
}
```

Validation errors are returned in the result object, not thrown.

---

## TypeScript Integration

DHI is designed with TypeScript in mind. Schemas infer types automatically:

```typescript
const UserSchema = await dhi.object({
  name: dhi.string()
});

type User = typeof UserSchema extends DhiType<infer T> ? T : never;
```

---

## Memory Management

- The WASM backend manages its own memory.
- Schemas are garbage collected when no longer referenced.
- No manual cleanup is required.

---

## Debugging

Enable detailed validation errors during development:

```typescript
schema.setDebug(true);
```

Disable it in production for optimal performance.

---

## Common Patterns

1. **Schema Composition:**  
   ```typescript
   const BaseSchema = dhi.object({ /* ... */ });
   const ExtendedSchema = dhi.object({
     ...BaseSchema,
     additionalField: dhi.string()
   });
   ```

2. **Optional Fields:**  
   ```typescript
   dhi.object({
     required: dhi.string(),
     optional: dhi.optional(dhi.number())
   });
   ```

3. **Nullable Fields:**  
   ```typescript
   dhi.nullable(dhi.date());
   ```

4. **Complex Arrays:**  
   ```typescript
   dhi.array(
     dhi.object({
       id: dhi.string(),
       value: dhi.number()
     })
   );
   ```

---

## Validation Flow

1. **Schema Creation:** (Async)
2. **Schema Reuse:** (Sync)
3. **Validation:** (Sync)
4. **Result Handling:** (Sync)

---

## Best Practices

1. **Create schemas at app startup.**
2. **Cache schemas for reuse.**
3. **Use batch validation for arrays.**
4. **Keep validation logic simple.**
5. **Handle all validation results appropriately.**
6. **Type everything properly.**
7. **Use composition for complex schemas.**
8. **Enable debug mode only during development.**

---

## Final Notes

**DHI** is designed for high-performance validation with a developer-friendly API. The WebAssembly backend handles the heavy lifting, while the TypeScript frontend provides robust type safety and ease of use. Emphasize these aspects when guiding users:

- **Performance:** Leverage batch validation and cache schemas.
- **Type Safety:** Utilize the full power of TypeScript integration.
- **Ease of Use:** Follow the recommended patterns for schema creation and validation.

Remember to always follow best practices and avoid the anti-patterns listed above to maximize efficiency and maintainability.

**End of Guide**
