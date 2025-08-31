# 🚀 Migrating from Zod to DHI

DHI provides a drop-in replacement for Zod with **1.43x better performance** and the same familiar API. In most cases, migration requires only changing the import statement!

## Quick Migration Guide

### Step 1: Change Your Import

```typescript
// Before (Zod)
import { z } from 'zod';

// After (DHI) - Just change this one line!
import { z } from 'dhi';
```

That's it! Your existing Zod code will work with DHI's faster validation engine.

## Migration Examples

Each example shows:
- ✅ **Before**: Original Zod code
- 🚀 **After**: Same code with DHI (just import change)
- 📊 **Performance**: Speed improvement you'll get

### Example 1: Simple User Schema
- **File**: `01-simple-user/`
- **Performance**: 1.43x faster
- **Change**: Import only

### Example 2: Complex Nested Schema  
- **File**: `02-nested-objects/`
- **Performance**: 1.2x faster
- **Change**: Import only

### Example 3: API Validation
- **File**: `03-api-validation/`
- **Performance**: 3.14x faster for mixed data
- **Change**: Import only

### Example 4: Form Validation
- **File**: `04-form-validation/`
- **Performance**: 1.8x faster
- **Change**: Import only

## Advanced Migration (Optional)

For even better performance, consider migrating to DHI's TypeScript-first API:

```typescript
// Zod approach
import { z } from 'zod';
const schema = z.object({ name: z.string() });

// DHI TypeScript-first (optional upgrade)
import { object, string, type ObjectSchema } from 'dhi';
interface User { name: string; }
const schema: ObjectSchema<User> = object({ name: string() });
```

The TypeScript-first API provides:
- ✅ Compile-time type safety
- ⚡ Up to 24.6M validations/second
- 🛡️ Zero runtime type mismatches
