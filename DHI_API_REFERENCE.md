# dhi API Reference - All Languages

Complete API documentation for the dhi validation library across all supported languages.

---

## Zig Core API (src/wasm_api.zig)

### String Validators

```zig
// Email validation (RFC 5322 compliant)
export fn validate_email(ptr: [*]const u8, len: usize) bool

// URL validation
export fn validate_url(ptr: [*]const u8, len: usize) bool

// UUID validation (v1-v5)
export fn validate_uuid(ptr: [*]const u8, len: usize) bool

// IPv4 validation
export fn validate_ipv4(ptr: [*]const u8, len: usize) bool

// String length validation
export fn validate_string_length(_: [*]const u8, len: usize, min: usize, max: usize) bool

// ISO date validation (YYYY-MM-DD)
export fn validate_iso_date(ptr: [*]const u8, len: usize) bool

// ISO datetime validation (YYYY-MM-DDTHH:MM:SSZ)
export fn validate_iso_datetime(ptr: [*]const u8, len: usize) bool

// Base64 validation
export fn validate_base64(ptr: [*]const u8, len: usize) bool

// String prefix/suffix validation
export fn validate_starts_with(str_ptr: [*]const u8, str_len: usize, prefix_ptr: [*]const u8, prefix_len: usize) bool
export fn validate_ends_with(str_ptr: [*]const u8, str_len: usize, suffix_ptr: [*]const u8, suffix_len: usize) bool
export fn validate_contains(str_ptr: [*]const u8, str_len: usize, substring_ptr: [*]const u8, substring_len: usize) bool
```

### Number Validators

```zig
// Integer range validation
export fn validate_int(value: i64, min: i64, max: i64) bool
export fn validate_int_gt(value: i64, min: i64) bool
export fn validate_int_gte(value: i64, min: i64) bool
export fn validate_int_lt(value: i64, max: i64) bool
export fn validate_int_lte(value: i64, max: i64) bool

// Integer constraints
export fn validate_int_positive(value: i64) bool
export fn validate_int_non_negative(value: i64) bool
export fn validate_int_negative(value: i64) bool
export fn validate_int_nonpositive(value: i64) bool
export fn validate_int_multiple_of(value: i64, divisor: i64) bool

// Float comparisons
export fn validate_float_gt(value: f64, min: f64) bool
export fn validate_float_gte(value: f64, min: f64) bool
export fn validate_float_lt(value: f64, max: f64) bool
export fn validate_float_lte(value: f64, max: f64) bool
export fn validate_float_finite(value: f64) bool
export fn validate_float_negative(value: f64) bool
export fn validate_float_nonpositive(value: f64) bool
export fn validate_float_multiple_of(value: f64, divisor: f64) bool
```

### Batch Operations

```zig
// Ultra-fast batch string length validation
export fn validate_string_lengths_batch(
    count: u32,
    lengths_ptr: [*]const u32,
    min: u32,
    max: u32,
    results_ptr: [*]u8
) void

// Ultra-fast batch number validation
export fn validate_numbers_batch(
    count: u32,
    numbers_ptr: [*]const f64,
    min: f64,
    max: f64,
    results_ptr: [*]u8
) void

// Complex batch validation with field specs
export fn validate_batch(
    items_ptr: [*]const u8,
    items_len: usize,
    num_items: usize,
    validator_type: u8,
    param1: i64,
    param2: i64
) ?[*]u8

// Optimized batch validation with multiple fields
export fn validate_batch_optimized(
    spec_ptr: [*]const u8,
    spec_len: usize,
    items_ptr: [*]const u8,
    items_len: usize
) ?[*]u8
```

### Memory Management

```zig
// WASM memory allocation
export fn alloc(size: usize) ?[*]u8
export fn dealloc(ptr: [*]u8, size: usize) void
```

---

## TypeScript API (js-bindings/schema.ts)

### Core Schema Classes

```typescript
export abstract class Schema<T = any> {
  abstract _validate(value: any): ValidationResult<T>;

  parse(value: any): T;
  safeParse(value: any): ValidationResult<T>;

  optional(): OptionalSchema<T>;
  nullable(): NullableSchema<T>;
  default(defaultValue: T): DefaultSchema<T>;
  transform<U>(fn: (value: T) => U): TransformSchema<T, U>;
  refine(check: (value: T) => boolean, message?: string): RefineSchema<T>;
}
```

### String Schema

```typescript
export class StringSchema extends Schema<string> {
  min(length: number): this;
  max(length: number): this;
  length(length: number): this;
  email(): this;
  url(): this;
  uuid(): this;
  startsWith(prefix: string): this;
  endsWith(suffix: string): this;
  includes(substring: string): this;
  regex(pattern: RegExp): this;
  trim(): TransformSchema<string, string>;
  lowercase(): TransformSchema<string, string>;
  uppercase(): TransformSchema<string, string>;
}
```

### Number Schema

```typescript
export class NumberSchema extends Schema<number> {
  min(value: number): this;
  max(value: number): this;
  gt(value: number): this;
  gte(value: number): this;
  lt(value: number): this;
  lte(value: number): this;
  positive(): this;
  negative(): this;
  int(): this;
  multipleOf(divisor: number): this;
}
```

### Primitive Schemas

```typescript
export class BooleanSchema extends Schema<boolean> {}
export class NullSchema extends Schema<null> {}
export class UndefinedSchema extends Schema<undefined> {}
export class AnySchema extends Schema<any> {}
```

### Composite Schemas

```typescript
export class EnumSchema<T extends string> extends Schema<T> {
  constructor(values: readonly T[]);
}

export class ArraySchema<T> extends Schema<T[]> {
  constructor(element: Schema<T>);
  min(length: number): this;
  max(length: number): this;
}

export class ObjectSchema<T extends Record<string, any>> extends Schema<T> {
  constructor(shape: { [K in keyof T]: Schema<T[K]> });
  strict(): this;        // Reject unknown keys
  passthrough(): this;   // Allow unknown keys
}
```

### Modifier Schemas

```typescript
export class OptionalSchema<T> extends Schema<T | undefined> {
  constructor(inner: Schema<T>);
}

export class NullableSchema<T> extends Schema<T | null> {
  constructor(inner: Schema<T>);
}

export class DefaultSchema<T> extends Schema<T> {
  constructor(inner: Schema<T>, defaultValue: T);
}

export class TransformSchema<T, U> extends Schema<U> {
  constructor(inner: Schema<T>, transformer: (value: T) => U);
}

export class RefineSchema<T> extends Schema<T> {
  constructor(inner: Schema<T>, check: (value: T) => boolean, message?: string);
}

export class UnionSchema extends Schema<any> {
  constructor(options: Schema<any>[]);
}
```

### Factory Functions

```typescript
export const z = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  null: () => new NullSchema(),
  undefined: () => new UndefinedSchema(),
  any: () => new AnySchema(),

  array: <T>(element: Schema<T>) => new ArraySchema(element),
  object: <T extends Record<string, any>>(shape: { [K in keyof T]: Schema<T[K]> }) => new ObjectSchema(shape),
  enum: <T extends string>(values: readonly T[]) => new EnumSchema(values),
  union: (options: Schema<any>[]) => new UnionSchema(options),

  optional: <T>(schema: Schema<T>) => new OptionalSchema(schema),
  nullable: <T>(schema: Schema<T>) => new NullableSchema(schema),
};

export type infer<T extends Schema<any>> = T extends Schema<infer U> ? U : never;
```

### Batch API (js-bindings/index.ts)

```typescript
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    issues: Array<{
      path: (string | number)[];
      message: string;
      code: string;
    }>;
  };
}

export interface BatchResult {
  valid: any[];
  invalid: Array<{
    item: any;
    errors: Array<{
      path: (string | number)[];
      message: string;
      code: string;
    }>;
  }>;
  stats: {
    total: number;
    valid: number;
    invalid: number;
    durationMs: number;
  };
}

export declare function validateBatch(
  items: any[],
  schema: {
    [field: string]: (value: any) => boolean | string | {
      type: string;
      min?: number;
      max?: number;
      pattern?: RegExp;
    };
  },
  options?: {
    earlyExit?: boolean;
    maxErrors?: number;
  }
): BatchResult;
```

---

## Python API (python-bindings/dhi/)

### Core Classes (dhi/validator.py)

#### ValidationError

```python
class ValidationError(Exception):
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")
```

#### ValidationErrors

```python
class ValidationErrors(Exception):
    def __init__(self, errors: List[ValidationError]):
        self.errors = errors
        messages = "\n".join(str(e) for e in errors)
        super().__init__(f"Validation failed:\n{messages}")
```

#### BoundedInt

```python
class BoundedInt:
    def __init__(self, min_val: int, max_val: int):
        self.min_val = min_val
        self.max_val = max_val

    def validate(self, value: int) -> int:
        """Validate integer is within bounds"""
        if not isinstance(value, int):
            raise ValidationError("value", f"Expected int, got {type(value).__name__}")

        # Uses native C extension or Zig or pure Python
        # Raises ValidationError on failure
        # Returns validated value on success

    def __call__(self, value: int) -> int:
        """Allow using as a callable validator"""
        return self.validate(value)
```

#### BoundedString

```python
class BoundedString:
    def __init__(self, min_len: int, max_len: int):
        self.min_len = min_len
        self.max_len = max_len

    def validate(self, value: str) -> str:
        """Validate string length is within bounds"""
        if not isinstance(value, str):
            raise ValidationError("value", f"Expected str, got {type(value).__name__}")

        # Uses native validation
        # Raises ValidationError on failure
        # Returns validated value on success

    def __call__(self, value: str) -> str:
        """Allow using as a callable validator"""
        return self.validate(value)
```

#### Email

```python
class Email:
    @staticmethod
    def validate(value: str) -> str:
        """Validate email format (simple check)"""
        if not isinstance(value, str):
            raise ValidationError("value", f"Expected str, got {type(value).__name__}")

        # Uses native C extension or Zig or pure Python
        # Raises ValidationError on failure
        # Returns validated value on success

    @staticmethod
    def __call__(value: str) -> str:
        """Allow using as a callable validator"""
        return Email.validate(value)
```

### Batch API (dhi/batch.py)

#### BatchValidator

```python
class BatchValidator:
    def validate_batch(
        self,
        items: List[dict],
        schema: dict
    ) -> dict:
        """
        Validate multiple items at once.

        Args:
            items: List of dictionaries to validate
            schema: Schema definition

        Returns:
            {
                'valid': [...],     # Valid items
                'invalid': [...],   # Invalid items with error details
                'stats': {...}      # Validation statistics
            }
        """

    def validate_emails(self, emails: List[str]) -> dict:
        """Batch validate email addresses"""

    def validate_urls(self, urls: List[str]) -> dict:
        """Batch validate URLs"""
```

### Schema Format

```python
# Schema definition for batch validation
schema = {
    "field_name": "validator_type",  # Simple
    "field_name": {                  # Complex
        "type": "validator_type",
        "params": {...}
    }
}

# Supported validator types:
# - "email"
# - "url"
# - "uuid"
# - "positive_number"
# - "string_length" (requires min, max params)
```

### Main Validator Class (dhi/__init__.py)

```python
class Validator:
    def validate_email(self, email: str) -> dict:
        """
        Validate email address.

        Returns:
            {'valid': True, 'value': 'user@example.com'}
            or
            {'valid': False, 'error': 'Invalid email format'}
        """

    def validate_url(self, url: str) -> dict:
        """Validate URL format"""

    def validate_uuid(self, uuid_str: str) -> dict:
        """Validate UUID format"""

    def validate_string_length(self, s: str, min_len: int, max_len: int) -> dict:
        """Validate string length"""

    def validate_positive_number(self, num: float) -> dict:
        """Validate positive number"""

    def validate_email_batch(self, emails: List[str]) -> dict:
        """
        Batch validate emails.

        Returns:
            {'valid': [...], 'invalid': [...]}
        """
```

---

## Performance Characteristics

### Single Validation (ops/sec)

| Operation | Zig (WASM) | TypeScript | Python (C ext) | Python (Pure) |
|-----------|------------|------------|----------------|---------------|
| Email | ~27M | ~6M | ~25M | ~500K |
| URL | ~25M | ~5M | ~23M | ~400K |
| UUID | ~30M | ~7M | ~28M | ~600K |
| String length | ~50M | ~15M | ~45M | ~2M |
| Int range | ~40M | ~12M | ~38M | ~3M |

### Batch Performance

- **Email batch**: 25-30M validations/sec
- **Mixed validation**: 15-20M validations/sec
- **Memory efficiency**: <2x input size peak usage

### Memory Usage

- **Single validation**: <1KB overhead
- **Batch (10K items)**: ~500KB total
- **WASM module**: 9.2KB
- **C extension**: 53KB
- **Python overhead**: ~200KB per validator instance

---

## Error Codes

### TypeScript

```typescript
type ValidationError = {
  path: (string | number)[];  // Path to invalid field
  message: string;            // Human-readable message
  code: string;               // Machine-readable code
};
```

### Error Codes

| Code | Description | Example |
|------|-------------|---------|
| `invalid_type` | Wrong type | Expected string, got number |
| `too_small` | Value too small | Must be >= 5 |
| `too_big` | Value too big | Must be <= 100 |
| `invalid_string` | Invalid string format | Invalid email |
| `invalid_enum_value` | Not in enum | Must be one of: A, B, C |
| `unrecognized_keys` | Extra keys in strict mode | Unknown key: extraField |
| `custom` | Custom refinement failed | Invalid value |

### Python

```python
class ValidationError(Exception):
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
```

---

## Platform Support

### TypeScript/JavaScript

| Runtime | Status | Notes |
|---------|--------|-------|
| Node.js 18+ | ✅ | Full support |
| Bun | ✅ | Full support |
| Deno | ✅ | Full support |
| Browsers | ✅ | WASM support required |
| Cloudflare Workers | ✅ | WASM support |
| Vercel Edge | ✅ | WASM support |

### Python

| Platform | Extension | Status | Notes |
|----------|-----------|--------|-------|
| macOS ARM64 | .cpython-312-darwin.so | ✅ | Tested |
| macOS x86_64 | .cpython-312-darwin.so | ✅ | Tested |
| Linux x86_64 | .cpython-312-linux-gnu.so | ✅ | Tested |
| Linux ARM64 | .cpython-312-linux-gnu.so | ✅ | Tested |
| Windows x86_64 | .pyd | ⚠️ | Needs testing |
| PyPy | N/A | ❌ | C extension incompatible |

---

## Build & Development

### Zig (Core)

```bash
# Build WASM
zig build -Doptimize=ReleaseSmall

# Build native library
zig build -Doptimize=ReleaseFast

# Run tests
zig build test
```

### TypeScript

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Benchmark
npm run bench
```

### Python

```bash
# Build C extension
python setup.py build_ext --inplace

# Install
pip install -e .

# Test
pytest

# Benchmark
python benchmark.py
```

---

## Integration Examples

### TypeScript: Zod-like API

```typescript
import { z } from "dhi";

const UserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().positive().int().max(120),
  role: z.enum(["admin", "user", "guest"]),
  metadata: z.object({
    tags: z.array(z.string()),
    verified: z.boolean()
  }).optional()
}).strict();

try {
  const user = UserSchema.parse(inputData);
  console.log("Valid user:", user);
} catch (error) {
  console.error("Validation failed:", error);
}
```

### Python: Simple Validators

```python
from dhi import Validator

v = Validator()

# Single validation
result = v.validate_email("user@example.com")
if result["valid"]:
    print("Valid email:", result["value"])
else:
    print("Invalid email:", result["error"])

# Batch validation
from dhi import BatchValidator

bv = BatchValidator()
schema = {
    "email": "email",
    "age": {"type": "positive_number"}
}

results = bv.validate_batch(users, schema)
print(f"Validated {len(results['valid'])} users")
print(f"Rejected {len(results['invalid'])} users")
```

### Python: Class-based Validators

```python
from dhi.validator import BoundedInt, BoundedString, Email

# Create validators
age_validator = BoundedInt(0, 120)
name_validator = BoundedString(2, 100)
email_validator = Email

# Use them
try:
    age = age_validator.validate(25)
    name = name_validator.validate("John Doe")
    email = email_validator.validate("john@example.com")
    print("All valid!")
except ValidationError as e:
    print(f"Validation failed: {e}")
```

---

## Migration Guides

### From Zod (TypeScript)

```typescript
// Before (Zod)
import { z } from "zod";
const schema = z.object({
  email: z.string().email(),
  age: z.number().positive()
});

// After (dhi)
import { z } from "dhi";
const schema = z.object({
  email: z.string().email(),
  age: z.number().positive()
});
// Everything else works the same!
```

### From Pydantic (Python)

```python
# Before (Pydantic)
from pydantic import BaseModel, validator

class User(BaseModel):
    email: str
    age: int

    @validator('age')
    def validate_age(cls, v):
        if v < 0:
            raise ValueError('Age must be positive')
        return v

# After (dhi)
from dhi import Validator

v = Validator()
user_data = {"email": "user@example.com", "age": 25}

# Validate individual fields
email_result = v.validate_email(user_data["email"])
age_result = v.validate_positive_number(user_data["age"])

# Or use batch validation
from dhi import BatchValidator
bv = BatchValidator()
results = bv.validate_batch([user_data], {
    "email": "email",
    "age": {"type": "positive_number"}
})
```

---

## Advanced Usage

### Custom Validators (TypeScript)

```typescript
import { z } from "dhi";

// Custom refinement
const EvenNumberSchema = z.number().refine(
  (n) => n % 2 === 0,
  "Must be even"
);

// Transform
const UppercaseStringSchema = z.string().transform(
  (s) => s.toUpperCase()
);

// Union with discriminant
const ShapeSchema = z.union([
  z.object({ type: z.literal("circle"), radius: z.number() }),
  z.object({ type: z.literal("rectangle"), width: z.number(), height: z.number() })
]);
```

### Streaming Validation (TypeScript)

```typescript
import dhi from "dhi";

// Process large files without loading everything into memory
const results = dhi.validateBatch(largeDataset, {
  email: dhi.z.email(),
  age: dhi.z.positive(),
  name: dhi.z.string(2, 100)
}, {
  earlyExit: false,  // Process all items even if some fail
  maxErrors: 1000    // Stop after too many errors
});

console.log(`Processed ${results.stats.total} items`);
console.log(`${results.valid.length} valid, ${results.invalid.length} invalid`);
```

---

## Troubleshooting

### TypeScript

**WASM not loading:**
```typescript
// Check if dhi.wasm exists in node_modules/dhi/
import fs from "fs";
console.log(fs.existsSync("node_modules/dhi/dhi.wasm"));
```

**Type errors:**
```json
// Add to tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

### Python

**Extension not loading:**
```python
import dhi
# Should show: Loaded native Zig library v0.3.0

# Check if extension exists
import os
print(os.path.exists("dhi/_dhi_native.cpython-312-darwin.so"))
```

**Performance issues:**
```python
# Profile your validation code
import cProfile
cProfile.run("v.validate_email('test@example.com')", "profile.prof")
```

---

This comprehensive API reference covers all three language implementations of dhi, from the low-level Zig WASM functions to the high-level TypeScript and Python APIs.
