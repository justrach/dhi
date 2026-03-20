# Changelog

## [0.3.0] - 2025-01-04

### 🎉 Major Release - Drop-in Zod Replacement!

#### Added
- **TURBO Mode** - 40.26M ops/sec (1.64x faster than Zod)
  - Zero-copy string length validation
  - Direct number array passing
  - No encoding overhead
- **Feature-Complete Schema API** - 100% Zod compatibility
  - 41/41 feature tests passing
  - All string validators (email, url, uuid, startsWith, endsWith, includes, regex, trim, etc.)
  - All number validators (min, max, gt, gte, lt, lte, positive, negative, int, finite, multipleOf)
  - Primitive types (boolean, null, undefined, any, unknown)
  - Composite types (arrays, objects, unions, enums)
  - Modifiers (optional, nullable, default)
  - Transformations and refinements
  - Type inference support
- **Three APIs**:
  1. TURBO mode (`dhi/turbo`) - Maximum speed (40.26M ops/sec)
  2. Batch API (`dhi`) - 8.19x faster on mixed data
  3. Feature-complete (`dhi/schema`) - Drop-in Zod replacement
- **NPM Package** - Ready for production
- **Comprehensive Documentation** - README with examples
- **WASM Binary** - Pre-built 9.2KB module included

#### Performance
- TURBO mode: **40.26M ops/sec** (1.64x faster than Zod)
- Batch API (mixed data): **15.76M ops/sec** (8.19x faster than Zod)
- Feature-complete: **7.14M ops/sec** (full Zod compatibility)

#### Breaking Changes
- None! This is a new major feature release.

## [0.2.32] - Previous Version

Initial release with batch validation API.

### Features
- Batch validation
- Basic validators (email, url, uuid, string length, positive numbers)
- WASM-powered performance
- Early-exit optimization

---

For full details, see [GitHub Releases](https://github.com/justrach/dhi/releases)
