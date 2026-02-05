# Publishing dhi to npm

## Prerequisites

✅ All files ready:
- `package.json` (version 0.3.0)
- `README.md` (usage guide)
- `CHANGELOG.md` (version history)
- `LICENSE` (MIT)
- `.npmignore` (exclude tests/benchmarks)
- `dhi.wasm` (9.2KB binary)
- `schema.ts` (main API)
- `schema-turbo.ts` (TURBO mode)
- `index.ts` (batch API)

## Pre-Publish Checklist

### 1. Verify Files to be Published

```bash
cd js-bindings
npm pack --dry-run
```

This shows what will be included. Should see:
- All `.ts` files (except benchmarks/tests)
- `dhi.wasm`
- `README.md`, `LICENSE`, `CHANGELOG.md`
- `package.json`

### 2. Test Locally

```bash
# Create a test project
cd /tmp
mkdir test-dhi
cd test-dhi
npm init -y

# Install from local directory
npm install /Users/rachpradhan/satya-zig/js-bindings

# Test it works
cat > test.ts << 'EOF'
import { z } from "dhi";

const schema = z.object({
  name: z.string(),
  age: z.number()
});

console.log(schema.parse({ name: "Alice", age: 30 }));
EOF

bun test.ts
```

### 3. Login to npm

```bash
npm login
```

Enter your npm credentials.

## Publishing Options

### Option 1: Manual Publish (Recommended for First Time)

```bash
cd /Users/rachpradhan/satya-zig/js-bindings

# Final check
npm pack --dry-run

# Publish!
npm publish --access public

# If you get an error about the package name being taken,
# you may need to publish under a scope:
# npm publish --access public
```

### Option 2: GitHub Actions (Automated)

1. **Add NPM Token to GitHub Secrets**

   ```bash
   # Generate token on npmjs.com
   # Account Settings > Access Tokens > Generate New Token
   # Select "Automation" type
   ```

   - Go to: https://github.com/justrach/satya-zig/settings/secrets/actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: (paste your npm token)

2. **Trigger the Workflow**

   Option A: Push a tag
   ```bash
   git tag v0.3.0
   git push origin v0.3.0
   ```

   Option B: Manual trigger
   - Go to: https://github.com/justrach/satya-zig/actions/workflows/publish-npm.yml
   - Click "Run workflow"
   - Enter version: `0.3.0`
   - Click "Run workflow"

## Post-Publish

### 1. Verify on npm

```bash
# Check it's published
npm view dhi

# Install and test
npm install dhi

# Or with specific version
npm install dhi@0.3.0
```

### 2. Update README badges

Add to main README.md:
```markdown
[![npm version](https://badge.fury.io/js/dhi.svg)](https://www.npmjs.com/package/dhi)
[![npm downloads](https://img.shields.io/npm/dm/dhi.svg)](https://www.npmjs.com/package/dhi)
```

### 3. Announce!

Tweet/post about it:
```
🚀 dhi v0.3.0 is live on npm!

The fastest TypeScript validation library:
- 4.86x faster than Zod (official benchmarks)
- Drop-in replacement with full compatibility
- WASM-powered, 9.2KB bundle

npm install dhi

https://github.com/justrach/satya-zig
```

## Troubleshooting

### Package name already taken

If `dhi` is taken, you have options:

1. **Use a scoped package:**
   ```json
   {
     "name": "@yourusername/dhi",
   }
   ```

2. **Request the name** (if package is inactive):
   - https://www.npmjs.com/support

### Publishing fails

```bash
# Check you're logged in
npm whoami

# Check package.json is valid
npm pkg validate

# Check what will be published
npm pack --dry-run
```

### WASM file not included

Make sure `.npmignore` doesn't exclude `.wasm` files:
```bash
# Should show dhi.wasm
npm pack --dry-run | grep wasm
```

## Version Management

### Patch release (0.3.1)
```bash
npm version patch
git push && git push --tags
npm publish
```

### Minor release (0.4.0)
```bash
npm version minor
git push && git push --tags
npm publish
```

### Major release (1.0.0)
```bash
npm version major
git push && git push --tags
npm publish
```

## Success Criteria

✅ Package visible at https://www.npmjs.com/package/dhi  
✅ Can install with `npm install dhi`  
✅ Import works: `import { z } from "dhi/schema"`  
✅ WASM loads correctly  
✅ Benchmarks run successfully  
✅ Tests pass  

---

**Ready to ship! Let's make dhi the fastest validator in the JavaScript ecosystem!** 🚀
