# Adding dhi to Official typescript-runtime-type-benchmarks

Now that dhi is published on npm, let's get it into the official benchmark suite!

## Steps to Submit to Official Benchmarks

### 1. Fork the Benchmark Repo

```bash
# Go to https://github.com/moltar/typescript-runtime-type-benchmarks
# Click "Fork" button
```

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/typescript-runtime-type-benchmarks.git
cd typescript-runtime-type-benchmarks
```

### 3. Add dhi to package.json

```bash
# Edit package.json and add dhi to dependencies
npm install dhi --save
```

Or manually add to `package.json`:
```json
{
  "dependencies": {
    "dhi": "^0.3.0"
  }
}
```

### 4. Create the dhi Test Case

Create `cases/dhi.ts`:

```typescript
import { z } from 'dhi/schema';
import { createCase } from '../benchmarks';

createCase('dhi', 'parseSafe', () => {
  const dataType = z.object({
    number: z.number(),
    negNumber: z.number(),
    maxNumber: z.number(),
    string: z.string(),
    longString: z.string(),
    boolean: z.boolean(),
    deeplyNested: z.object({
      foo: z.string(),
      num: z.number(),
      bool: z.boolean(),
    }),
  });

  return data => {
    return dataType.parse(data);
  };
});

createCase('dhi', 'parseStrict', () => {
  const dataType = z.object({
    number: z.number(),
    negNumber: z.number(),
    maxNumber: z.number(),
    string: z.string(),
    longString: z.string(),
    boolean: z.boolean(),
    deeplyNested: z.object({
      foo: z.string(),
      num: z.number(),
      bool: z.boolean(),
    }),
  });

  return data => {
    return dataType.parse(data);
  };
});

createCase('dhi', 'assertLoose', () => {
  const dataType = z.object({
    number: z.number(),
    negNumber: z.number(),
    maxNumber: z.number(),
    string: z.string(),
    longString: z.string(),
    boolean: z.boolean(),
    deeplyNested: z.object({
      foo: z.string(),
      num: z.number(),
      bool: z.boolean(),
    }),
  });

  return data => {
    dataType.parse(data);
    return true;
  };
});

createCase('dhi', 'assertStrict', () => {
  const dataType = z.object({
    number: z.number(),
    negNumber: z.number(),
    maxNumber: z.number(),
    string: z.string(),
    longString: z.string(),
    boolean: z.boolean(),
    deeplyNested: z.object({
      foo: z.string(),
      num: z.number(),
      bool: z.boolean(),
    }),
  });

  return data => {
    dataType.parse(data);
    return true;
  };
});
```

### 5. Test Locally

```bash
# Install dependencies
bun install

# Run dhi benchmark
bun index.ts run dhi

# Compare with others
bun index.ts run dhi zod valibot arktype
```

### 6. Commit and Push

```bash
git add .
git commit -m "Add dhi - 4.86x faster than Zod"
git push origin main
```

### 7. Create Pull Request

1. Go to your fork on GitHub
2. Click "Contribute" → "Open pull request"
3. Title: **Add dhi validation library**
4. Description:

```markdown
## Add dhi validation library

dhi is a WASM-powered validation library that's 4.86x faster than Zod.

### Performance
- parseSafe: 7.07M ops/s (3.28x faster than Zod)
- parseStrict: 6.94M ops/s (5.27x faster than Zod)
- assertLoose: 6.86M ops/s (5.37x faster than Zod)
- assertStrict: 6.87M ops/s (5.53x faster than Zod)

### Links
- npm: https://www.npmjs.com/package/dhi
- GitHub: https://github.com/justrach/satya-zig
- Docs: https://github.com/justrach/satya-zig/blob/main/js-bindings/README.md

### Features
- Drop-in Zod replacement
- Full TypeScript support
- WASM-powered (9.2KB bundle)
- 100% Zod API compatible

### Test Results
All 4 test cases pass with expected performance.
```

5. Click "Create pull request"

### 8. Wait for Review

The maintainers will:
- Review your code
- Run benchmarks on their infrastructure
- Merge if everything looks good
- Your library will appear on https://moltar.github.io/typescript-runtime-type-benchmarks/

## Alternative: Open an Issue First

If you want feedback before submitting a PR:

1. Go to https://github.com/moltar/typescript-runtime-type-benchmarks/issues
2. Click "New issue"
3. Title: "Add dhi validation library"
4. Describe dhi and link to npm package
5. Ask if they'd accept a PR

## Expected Timeline

- PR review: 1-7 days
- Merge: 1-14 days
- Live on site: Next benchmark run (weekly/monthly)

## Tips for Success

✅ **Follow existing patterns**: Copy the structure from `zod.ts`  
✅ **Test thoroughly**: Make sure all 4 cases work  
✅ **Keep it simple**: No custom compilation steps  
✅ **Document well**: Clear PR description  
✅ **Be responsive**: Answer questions quickly  

## What Happens After Merge

1. **Charts updated**: dhi appears in performance graphs
2. **Rankings**: Listed alongside 65+ other validators
3. **Visibility**: Developers discover dhi through the benchmark
4. **Credibility**: Official validation of performance claims

## Promotion Strategy

Once merged:
1. **Update README**: Add badge showing benchmark results
2. **Tweet about it**: "dhi now in official benchmarks!"
3. **Reddit posts**: Share in r/typescript, r/javascript
4. **HN submission**: If results are exceptional

---

**Let's get dhi into the official benchmarks and show the world how fast it is!** 🚀
