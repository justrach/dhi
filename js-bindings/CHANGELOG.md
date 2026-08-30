# Changelog

## [1.6.0] - 2026-08-30

### Added
- **Zod 4 core compatibility (`schema._zod`)** — every dhi schema now exposes Zod 4's
  internals (`_zod.def`, `_zod.run`, `optin`/`optout`, `values`, JSON-Schema hook) and is
  assignable to Zod's `$ZodType` at the type level. Libraries that detect Zod 4 schemas and
  call Zod's own core helpers work unchanged: `@modelcontextprotocol/sdk` `registerTool` /
  `registerPrompt` (object schemas, raw shapes, output schemas), `z.toJSONSchema(dhiSchema)`,
  `z.safeParse(dhiSchema, …)`, `instanceof z.ZodObject`. (#76)
- `tests/test-zod-parity.ts`: differential test running 250+ schemas over 4,400 inputs against
  the real `zod` package — accept/reject decisions and parsed output are identical.
- `tests/test-mcp-compat.ts` + `npm run typecheck` (strict type-level tests for object
  inference and MCP handler typing).
- Zod 4 standalone checks for `.check(...)`: `z.minLength`, `z.maxLength`, `z.length`,
  `z.minSize`, `z.maxSize`, `z.size`, `z.gt/gte/lt/lte`, `z.positive/negative/nonpositive/
  nonnegative`, `z.multipleOf`, `z.regex`, `z.includes`, `z.startsWith`, `z.endsWith`,
  `z.lowercase`, `z.uppercase`, `z.trim`, `z.toLowerCase`, `z.toUpperCase`, `z.normalize`,
  `z.overwrite`, `z.mime`, `z.property`, `z.refine`, `z.superRefine`, `z.check`.
  `.check()` accepts payload functions, check objects (including real Zod checks) and
  superRefine-style callbacks.
- `z.uuidv4/v6/v7`, `z.xid`, `z.ksuid`, `z.hash(alg, { enc })`, `z.url({ hostname, protocol,
  normalize })`, `z.httpUrl()`, `z.hostname()`, `z.hex()`, `z.stringbool({ truthy, falsy, case })`,
  `z.iso.datetime({ offset, local, precision })`, `z.iso.time({ precision })`, `z.mac({ delimiter })`,
  `z.jwt({ alg })`, `.includes(s, { position })`; every top-level format shortcut accepts
  Zod's optional message/params.
- `.nonoptional()` and `.exactOptional()` are real wrappers (`DhiNonOptional`, `DhiExactOptional`).
- `dhi/schema-nextjs` export alias (the path the Next.js guide documented).

### Changed
- **Single runtime-agnostic core.** `dhi`, `dhi/edge`, `dhi/cloudflare` and `dhi/nextjs` now
  re-export the same `schema-core.ts`: identical behaviour and JIT everywhere, no WASM
  instantiation, no top-level await, no bundler configuration. (The edge/Next.js entries had
  drifted ~800 lines behind the Node entry.)
- `DhiObject.parse()` / `.safeParse()` return the inferred object type instead of `any`;
  inferred object types are flattened for readable hovers. (#76)
- String formats now match Zod 4 exactly (verified by the parity test): `uuid` checks the
  RFC 9562 version/variant nibbles (`guid` stays loose), `url` accepts any WHATWG-parsable URL
  and trims (use `httpUrl` for http(s)+domain), `datetime` requires `Z` unless `offset`/`local`,
  `date` is leap-year aware, `time` allows omitted seconds, `duration` follows ISO 8601-1,
  `email` uses Zod's rules (`'` allowed, `%` and leading/trailing/double dots rejected),
  `ipv4` rejects leading zeros, `ipv6`/`cidrv6` use the WHATWG parser (IPv4-mapped forms
  pass), `base64` allows empty and requires proper padding, `base64url` allows empty,
  `ulid`/`xid` are case-insensitive, `e164` needs 7–15 digits, `mac` requires consistent case,
  `emoji` uses `Extended_Pictographic`, `cidrv4` validates octets and prefix.
- `.lowercase()` / `.uppercase()` **validate** case like Zod 4 (`.toLowerCase()` /
  `.toUpperCase()` transform).
- `z.number()` rejects `Infinity`/`-Infinity` (like Zod 4); `.int()` means safe integer;
  `.multipleOf()` uses Zod's float-safe remainder.
- Objects: absent optional keys stay absent in the output (no `key: undefined`), `.catchall()`
  validates unknown keys, exactOptional keys are skipped when absent; JSON Schema `required`
  follows Zod's `optin`/`optout` rule and `toJsonSchema({ io: 'input' | 'output' })` /
  `z.toJSONSchema(schema, { io })` are honoured (MCP tool input schemas use `input`).
- Tuples allow omitting trailing optional items; enum/literal-keyed records are exhaustive
  (`z.partialRecord` for optional keys); records only accept plain objects; `z.coerce.date()`
  coerces any input; `z.stringbool()` defaults include `y`/`n`/`enabled`/`disabled`;
  `z.success()` follows Zod 4 semantics; `isOptional()` / `isNullable()` are behaviour-based.
- Python wheels: Windows (AMD64, CPython 3.9–3.14 incl. free-threaded) are now built and
  published; `_native.c` compiles under MSVC. (#59)

### Fixed
- MCP SDK `tools/list` no longer fails with `def.shape is not a function`. (#76)
- Next.js guide now documents the exported `dhi/nextjs` path. (#76)

## [1.5.2] - 2026-07-11

### Fixed
- Unblocked npm publishing by removing the unsupported N-API build from the release workflow.
- Aligned macOS wheel metadata with Zig 0.17's macOS 14.0 deployment target.
- Enabled manual PyPI publishing from the wheel workflow.

## [1.5.1] - 2026-07-11

### Fixed
- Added Zig 0.17-dev compatibility for compile-time struct reflection.
- Replaced deprecated array repetition syntax with `@splat`.
- Updated CI and package metadata to require and test Zig 0.17-dev.

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
