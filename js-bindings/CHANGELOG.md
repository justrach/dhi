# Changelog

## [1.7.0] - 2026-08-30

### Performance
- Zig core: JSON parse/validate paths use a stack-owned arena instead of a heap-allocated
  `Parsed` wrapper (1.6–1.9× on the repo benchmark with the debug allocator, neutral on
  production allocators); `json_batch_validator` is now part of `zig build test`. (#80)

### Added
- **Codecs** — `z.codec(input, output, { decode, encode })` plus `z.encode/decode/safeEncode/
  safeDecode` (and the `*Async` variants) and the matching `.encode()/.decode()/.safeEncode()/
  .safeDecode()` methods on every schema. Encoding runs the schema backwards through codecs,
  pipes and `z.stringbool()`, and refuses one-way `.transform()`s with a `ZodEncodeError`.
- **Real async parsing** — `.parseAsync()` / `.safeParseAsync()` / `.spa()` await async
  refinements, superRefinements, transforms and `.check()` callbacks, including when nested in
  objects, arrays, tuples, records, sets, maps, unions and wrappers. A synchronous `.parse()`
  that meets one now throws `ZodAsyncError` instead of leaking a Promise.
- **Error helpers** — `z.treeifyError()`, `z.flattenError()`, `z.formatError()` (all with the
  optional issue mapper). `ZodError` is now an `Error` (with a lazily built `.stack`),
  and gains `.isEmpty`, `.addIssue()`, `.addIssues()` and mapper arguments on
  `.format()` / `.flatten()`.
- **Top-level functional API** — `z.parse/safeParse/parseAsync/safeParseAsync`, `z.transform`,
  `z.catch`, `z.default`/`z._default`, `z.prefault`, `z.nullish`, `z.nonoptional`, `z.readonly`,
  `z.exactOptional`, `z.keyof`, `z.clone`, `z.xor`, `z.stringFormat`, `z.slugify`, `z.describe`,
  `z.meta`, `z._function`, `z.fromJSONSchema`.
- **Constants and namespaces** — `z.NEVER`, `z.TimePrecision`, `z.ZodIssueCode`, `z.$brand`,
  `z.$input`, `z.$output`, `z.regexes`, `z.util`, `z.core`, `z.locales`, `z.config()`,
  `z.getErrorMap()`, `z.setErrorMap()`, and runtime `z.ZodString` / `z.ZodObject` / … class
  aliases so `instanceof` checks and `z.ZodType` resolve.
- **Schema introspection** — `.type`, `.apply()`, `.with()`, `.toJSONSchema()`, `.spa()` on every
  schema; `.format`/`.minValue`/`.maxValue`/`.isInt`/`.isFinite` on numbers, `.minValue`/
  `.maxValue` on bigints, `.minDate`/`.maxDate` on dates, `.element`/`.unwrap()` on arrays,
  `.values` on literals, `.keyType`/`.valueType` on records and maps, `.unwrap()` on the
  wrapper types, and `.input`/`.output` on functions.
- `z.object().safeExtend()`, `z.tuple(items, rest)`, `z.map().min/max/size/nonempty()`,
  `z.function().implementAsync()`, `z.string().slugify()`.
- `z.toJSONSchema()` now accepts `target`, `metadata`, `unrepresentable`, `override` and `io`,
  and emits Zod's document shape (`$schema`, `additionalProperties`, registry metadata).
  `schema.toJsonSchema()` keeps dhi's existing leaner output.
- `.meta()` registers in `z.globalRegistry` and reads back with no argument; registered metadata
  is emitted into the generated JSON Schema.

### Changed
- Issues now carry Zod 4 codes natively: `invalid_string` → `invalid_format`,
  `invalid_literal`/`invalid_enum_value` → `invalid_value`, `invalid_date` → `invalid_type`,
  `invalid_union_discriminator` → `invalid_union`. Zod 3 spellings passed to `ctx.addIssue()`
  are still accepted and normalised. Union failures now carry the members' issues under `errors`.
- `.prefault(v)` runs the fallback through the schema (so its checks and transforms apply);
  `.default(v)` still short-circuits, matching Zod.
- `.transform()` and codec transforms receive Zod's `ctx` (`{ value, issues, addIssue }`);
  `.catch()` receives `{ value, issues, error, input }`; `.refine()` accepts `{ when, abort,
  path, message, error }`; `ctx.addIssue()` keeps `fatal` and appends nested paths.
- `z.prettifyError()` uses Zod's layout (`✖ message` / `  → at a.b[0]`), and
  `error.flatten()` keys `fieldErrors` by the first path segment like Zod.
- `.extend()`, `.pick()`, `.omit()`, `.partial()` and `.required()` keep the object's
  unknown-key policy (strict / loose / catchall), matching Zod.
- `z.discriminatedUnion()` resolves discriminator values through optional, nullable, enum and
  nested-union options, and throws a descriptive error for an option that has none.
- `z.file().mime()` compares `File.type` exactly, like Zod.
- `z.string().slugify()` matches Zod's algorithm (non-word characters are dropped, not hyphenated).

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
- `z.enum([...])` infers the literal union (`'a' | 'b'`) instead of widening to `string`
  (`const` type parameter); `z.enum({ ... })` object form is accepted like Zod 4.
- Windows `pip install dhi` builds: `setup.py` reads the README as UTF-8; status output is
  ASCII-only; `_native.c` uses 64-bit integers (`long long`) everywhere so large ints
  validate and parse correctly on LLP64 platforms.

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
