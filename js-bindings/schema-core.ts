/**
 * dhi - Ultra-fast Zod 4 compatible schema validation
 * Full TypeScript type inference, complete Zod 4 API parity
 *
 * This is the runtime-agnostic core shared by every package entry point
 * (`dhi`, `dhi/edge`, `dhi/cloudflare`, `dhi/nextjs`). It has no top-level
 * await, no Node built-ins and no WASM dependency, so the same code runs in
 * Node, Bun, Deno, browsers, Cloudflare Workers and Next.js Edge alike.
 *
 * Usage:
 *   import { z } from 'dhi';
 *   const schema = z.object({ name: z.string(), age: z.number() });
 *   type User = z.infer<typeof schema>;
 */

// ============================================================================
// Shared helpers
// ============================================================================

/** Zod 4 accepts `string | { message } | { error }` for every check's custom message */
export type ZodMessage = string | { message?: string; error?: string | ((issue: any) => string) };

function msgOf(m: unknown): string | undefined {
  if (typeof m === 'string') return m;
  if (typeof m === 'object' && m !== null) {
    const o = m as { message?: unknown; error?: unknown };
    if (typeof o.message === 'string') return o.message;
    if (typeof o.error === 'string') return o.error;
  }
  return undefined;
}

// Lightweight Zod 4 `$ZodCheck`-shaped descriptor exposed through `_zod.def.checks`
function zodCheck(check: string, params: Record<string, any>, message?: string): any {
  const def: Record<string, any> = { check, ...params };
  if (message !== undefined) def.error = () => message;
  return { _zod: { def, check: () => {}, onattach: [] } };
}

// Zod: plain objects only (no arrays, Dates, Maps, class instances) — port of util.isPlainObject
function isPlainObject(o: unknown): o is Record<string, unknown> {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return false;
  const ctor = (o as any).constructor;
  if (ctor === undefined || typeof ctor !== 'function') return true;
  const proto = ctor.prototype;
  if (typeof proto !== 'object' || proto === null) return false;
  return Object.prototype.hasOwnProperty.call(proto, 'isPrototypeOf');
}

// Zod 4 `.multipleOf()` — float-safe remainder (port of util.floatSafeRemainder)
function isMultipleOf(val: number, step: number): boolean {
  // Fast path for ordinary integers; huge values go through Zod's exact (toFixed-based) algorithm
  if (Number.isInteger(val) && Number.isInteger(step) && val < 1e21 && val > -1e21 && step < 1e21 && step > -1e21) return val % step === 0;
  const valDec = (val.toString().split('.')[1] || '').length;
  const stepDec = (step.toString().split('.')[1] || '').length;
  const decCount = valDec > stepDec ? valDec : stepDec;
  const valInt = Number.parseInt(val.toFixed(decCount).replace('.', ''));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace('.', ''));
  return valInt % stepInt === 0;
}

// --------------------------------------------------------------------------
// Fast pure-JS validators. Accept/reject behaviour is identical to Zod 4
// (zod/v4/core/regexes.ts): the hot formats are hand-written scanners, the
// rest reuse Zod's own regexes verbatim.
// --------------------------------------------------------------------------

// Pre-computed lookup table for hex digits (charCode → valid)
const HEX_CHARS = new Uint8Array(128);
for (let i = 48; i <= 57; i++) HEX_CHARS[i] = 1;   // 0-9
for (let i = 65; i <= 70; i++) HEX_CHARS[i] = 1;   // A-F
for (let i = 97; i <= 102; i++) HEX_CHARS[i] = 1;  // a-f

// Pre-computed lookup table for base64 chars
const B64_CHARS = new Uint8Array(128);
for (let i = 65; i <= 90; i++) B64_CHARS[i] = 1;   // A-Z
for (let i = 97; i <= 122; i++) B64_CHARS[i] = 1;  // a-z
for (let i = 48; i <= 57; i++) B64_CHARS[i] = 1;   // 0-9
B64_CHARS[43] = 1; // +
B64_CHARS[47] = 1; // /

// Alphanumerics
const ALNUM = new Uint8Array(128);
for (let i = 65; i <= 90; i++) ALNUM[i] = 1;
for (let i = 97; i <= 122; i++) ALNUM[i] = 1;
for (let i = 48; i <= 57; i++) ALNUM[i] = 1;

// Email local-part chars per Zod 4: [A-Za-z0-9_'+\-.]
const EMAIL_LOCAL = new Uint8Array(128);
for (let i = 65; i <= 90; i++) EMAIL_LOCAL[i] = 1;  // A-Z
for (let i = 97; i <= 122; i++) EMAIL_LOCAL[i] = 1; // a-z
for (let i = 48; i <= 57; i++) EMAIL_LOCAL[i] = 1;  // 0-9
EMAIL_LOCAL[95] = 1; EMAIL_LOCAL[39] = 1; EMAIL_LOCAL[43] = 1; // _ ' +
EMAIL_LOCAL[45] = 1; EMAIL_LOCAL[46] = 1; // - .

// Same regexes as Zod 4
const CUID_RE = /^[cC][^\s-]{8,}$/;
const CUID2_RE = /^[0-9a-z]+$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
const XID_RE = /^[0-9a-vA-V]{20}$/;
const KSUID_RE = /^[A-Za-z0-9]{27}$/;
const NANOID_RE = /^[a-zA-Z0-9_-]{21}$/;
/** ISO 8601-1 duration (no 8601-2 extensions) */
const ISO_DURATION_RE = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
const EMOJI_RE = /^(\p{Extended_Pictographic}|\p{Emoji_Component})+$/u;
const CIDRV4_RE = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]*$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;
const HOSTNAME_RE = /^(?=.{1,253}\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\.?$/;
const DOMAIN_RE = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const HTTP_PROTOCOL_RE = /^https?$/;
const HEX_RE = /^[0-9a-fA-F]*$/;
const LOWERCASE_RE = /^[^A-Z]*$/;
const UPPERCASE_RE = /^[^a-z]*$/;

// Regex-backed string formats, keyed by dhi check type (used by the JIT emitter)
const FORMAT_REGEXES: Record<string, RegExp> = {
  cuid: CUID_RE, cuid2: CUID2_RE, ulid: ULID_RE, xid: XID_RE, ksuid: KSUID_RE, nanoid: NANOID_RE,
  duration: ISO_DURATION_RE, emoji: EMOJI_RE, cidrv4: CIDRV4_RE,
  e164: E164_RE, hostname: HOSTNAME_RE, hex: HEX_RE,
  lowercase: LOWERCASE_RE, uppercase: UPPERCASE_RE,
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function macRegex(delimiter?: string): RegExp {
  const d = escapeRegex(delimiter ?? ':');
  return new RegExp(`^(?:[0-9A-F]{2}${d}){5}[0-9A-F]{2}$|^(?:[0-9a-f]{2}${d}){5}[0-9a-f]{2}$`);
}

// [hex length, base64 body length, base64 padding]
const HASH_SHAPES: Record<string, [number, number, string]> = {
  md5: [32, 22, '=='],
  sha1: [40, 27, '='],
  sha256: [64, 43, '='],
  sha384: [96, 64, ''],
  sha512: [128, 86, '=='],
};

function hashRegex(algorithm: string, enc: 'hex' | 'base64' | 'base64url' = 'hex'): RegExp {
  const shape = HASH_SHAPES[algorithm];
  if (!shape) throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  const [hexLen, b64Len, pad] = shape;
  if (enc === 'base64') return new RegExp(`^[A-Za-z0-9+/]{${b64Len}}${pad}$`);
  if (enc === 'base64url') return new RegExp(`^[A-Za-z0-9_-]{${b64Len}}$`);
  return new RegExp(`^[0-9a-fA-F]{${hexLen}}$`);
}

// dhi check type → Zod 4 string format name (for `_zod.def.format` / checks)
const ZOD_FORMAT_NAMES: Record<string, string> = {
  email: 'email', url: 'url', uuid: 'uuid', guid: 'guid', cuid: 'cuid', cuid2: 'cuid2', ulid: 'ulid',
  emoji: 'emoji', ip: 'ip', ipv4: 'ipv4', ipv6: 'ipv6', base64: 'base64', base64url: 'base64url',
  datetime: 'datetime', date: 'date', time: 'time', duration: 'duration', jwt: 'jwt', nanoid: 'nanoid',
  cidrv4: 'cidrv4', cidrv6: 'cidrv6', e164: 'e164', mac: 'mac', xid: 'xid', ksuid: 'ksuid',
  hostname: 'hostname', hex: 'hex', hash: 'hash', lowercase: 'lowercase', uppercase: 'uppercase',
};

// ISO 8601 date/time — same sources as Zod 4
const ISO_DATE_SOURCE = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;

function isoTimeSource(precision?: number | null): string {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  if (typeof precision === 'number') {
    if (precision === -1) return hhmm;
    if (precision === 0) return `${hhmm}:[0-5]\\d`;
    return `${hhmm}:[0-5]\\d\\.\\d{${precision}}`;
  }
  return `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}

function isoTimeRegex(opts?: { precision?: number | null }): RegExp {
  return new RegExp(`^${isoTimeSource(opts?.precision)}$`);
}

function isoDatetimeRegex(opts?: { precision?: number | null; offset?: boolean; local?: boolean }): RegExp {
  const time = isoTimeSource(opts?.precision);
  const tz = ['Z'];
  if (opts?.local) tz.push('');
  if (opts?.offset) tz.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  return new RegExp(`^${ISO_DATE_SOURCE}T(?:${time}(?:${tz.join('|')}))$`);
}

// Any 8-4-4-4-12 hex identifier (Zod's `guid`). Branchless hex scan beats V8
// regex for this fixed layout (~50M/s vs ~36M/s isolated).
function fastValidateGuid(s: string): boolean {
  if (s.length !== 36) return false;
  if (s.charCodeAt(8) !== 45 || s.charCodeAt(13) !== 45 ||
      s.charCodeAt(18) !== 45 || s.charCodeAt(23) !== 45) return false;
  let bad = 0;
  for (let i = 0; i < 8; i++)   { const c = s.charCodeAt(i);  bad |= (c >> 7) | (1 - HEX_CHARS[c & 127]); }
  for (let i = 9; i < 13; i++)  { const c = s.charCodeAt(i);  bad |= (c >> 7) | (1 - HEX_CHARS[c & 127]); }
  for (let i = 14; i < 18; i++) { const c = s.charCodeAt(i);  bad |= (c >> 7) | (1 - HEX_CHARS[c & 127]); }
  for (let i = 19; i < 23; i++) { const c = s.charCodeAt(i);  bad |= (c >> 7) | (1 - HEX_CHARS[c & 127]); }
  for (let i = 24; i < 36; i++) { const c = s.charCodeAt(i);  bad |= (c >> 7) | (1 - HEX_CHARS[c & 127]); }
  return bad === 0;
}

// RFC 9562/4122 variant nibble: 8, 9, a, b (either case)
function isUuidVariant(c: number): boolean {
  return c === 56 || c === 57 || c === 97 || c === 98 || c === 65 || c === 66;
}

// RFC 9562/4122 UUID (Zod's `uuid`): version nibble 1-8 + variant nibble 8-b.
// The nil and max UUIDs are also accepted when no specific version is requested.
function fastValidateUuid(s: string, version?: number): boolean {
  if (!fastValidateGuid(s)) return false;
  const v = s.charCodeAt(14);
  if (version !== undefined) return v === 48 + version && isUuidVariant(s.charCodeAt(19));
  if (v >= 49 && v <= 56 && isUuidVariant(s.charCodeAt(19))) return true;
  return s === '00000000-0000-0000-0000-000000000000' || s === 'ffffffff-ffff-ffff-ffff-ffffffffffff';
}

// Zod's base64: empty string OK; otherwise length % 4 === 0 and atob() accepts it.
// The strict alphabet scan is the fast path; atob()'s "forgiving base64" (which
// also tolerates ASCII whitespace) is the exact fallback.
function fastValidateBase64(s: string): boolean {
  const len = s.length;
  if (len === 0) return true;
  if (len % 4 !== 0) return false;
  let end = len;
  if (s.charCodeAt(len - 1) === 61) {
    end--;
    if (s.charCodeAt(len - 2) === 61) end--;
  }
  let ok = true;
  for (let i = 0; i < end; i++) {
    const c = s.charCodeAt(i);
    if (c > 127 || !B64_CHARS[c]) { ok = false; break; }
  }
  if (ok) return true;
  try {
    atob(s);
    return true;
  } catch {
    return false;
  }
}

// Zod's base64url: url-safe alphabet, and valid base64 once padded
function fastValidateBase64Url(s: string): boolean {
  if (!BASE64URL_RE.test(s)) return false;
  const b64 = s.replace(/[-_]/g, c => (c === '-' ? '+' : '/'));
  return fastValidateBase64(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
}

// Zod 4 validates IPv6 with the WHATWG URL parser (so IPv4-mapped forms like
// ::ffff:1.2.3.4 pass and zone ids fail, exactly as in Zod)
function fastValidateIpv6(s: string): boolean {
  if (s.length === 0 || s.length > 64) return false;
  try {
    new URL(`http://[${s}]`);
    return true;
  } catch {
    return false;
  }
}

// Zod 4 CIDR v6: `<ipv6>/<0-128>`
function fastValidateCidrv6(s: string): boolean {
  const parts = s.split('/');
  const address = parts[0];
  const prefix = parts[1];
  if (!prefix) return false;
  const n = Number(prefix);
  if (`${n}` !== prefix || n < 0 || n > 128) return false;
  return fastValidateIpv6(address);
}

const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// YYYY-MM-DD with real month lengths and leap years (Zod's `date`)
function fastValidateDate(s: string): boolean {
  if (s.length !== 10) return false;
  if (s.charCodeAt(4) !== 45 || s.charCodeAt(7) !== 45) return false;
  const c0 = s.charCodeAt(0) - 48, c1 = s.charCodeAt(1) - 48, c2 = s.charCodeAt(2) - 48, c3 = s.charCodeAt(3) - 48;
  const c5 = s.charCodeAt(5) - 48, c6 = s.charCodeAt(6) - 48, c8 = s.charCodeAt(8) - 48, c9 = s.charCodeAt(9) - 48;
  // A non-digit char yields a value outside 0..9 (negative → huge after >>> 0)
  if ((c0 >>> 0) > 9 || (c1 >>> 0) > 9 || (c2 >>> 0) > 9 || (c3 >>> 0) > 9 ||
      (c5 >>> 0) > 9 || (c6 >>> 0) > 9 || (c8 >>> 0) > 9 || (c9 >>> 0) > 9) return false;
  const year = c0 * 1000 + c1 * 100 + c2 * 10 + c3;
  const month = c5 * 10 + c6;
  const day = c8 * 10 + c9;
  if (month < 1 || month > 12 || day < 1) return false;
  if (day <= DAYS_IN_MONTH[month]) return true;
  return month === 2 && day === 29 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
}

// Zod's default email regex, as a scanner:
//   ^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$
function fastValidateEmail(s: string): boolean {
  const len = s.length;
  const at = s.indexOf('@');
  if (at < 1 || at > len - 4) return false;
  if (s.charCodeAt(0) === 46) return false; // leading '.'
  let prevDot = false;
  for (let i = 0; i < at; i++) {
    const c = s.charCodeAt(i);
    if (c > 127 || !EMAIL_LOCAL[c]) return false;
    if (c === 46) {
      if (prevDot) return false; // '..'
      prevDot = true;
    } else {
      prevDot = false;
    }
  }
  if (prevDot) return false; // local part can't end with '.'
  let i = at + 1;
  let labels = 0;
  for (;;) {
    const start = i;
    let c = i < len ? s.charCodeAt(i) : 0;
    if (c > 127 || !ALNUM[c]) return false; // label must start alphanumeric
    i++;
    while (i < len) {
      c = s.charCodeAt(i);
      if (c < 128 && (ALNUM[c] || c === 45)) i++;
      else break;
    }
    if (i < len && s.charCodeAt(i) === 46) { labels++; i++; continue; }
    if (i !== len || labels === 0 || len - start < 2) return false;
    for (let j = start; j < len; j++) {
      const cc = s.charCodeAt(j);
      if (!((cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122))) return false; // TLD letters only
    }
    return true;
  }
}

// Zod 4 URL: any WHATWG-parsable URL (trimmed), optional hostname/protocol
// constraints; returns the output value (trimmed or normalized) or null.
function validateUrl(value: string, opts?: { hostname?: RegExp; protocol?: RegExp; normalize?: boolean }): string | null {
  const trimmed = value.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (opts) {
    if (opts.hostname) {
      opts.hostname.lastIndex = 0;
      if (!opts.hostname.test(url.hostname)) return null;
    }
    if (opts.protocol) {
      opts.protocol.lastIndex = 0;
      const proto = url.protocol.endsWith(':') ? url.protocol.slice(0, -1) : url.protocol;
      if (!opts.protocol.test(proto)) return null;
    }
    if (opts.normalize) return url.href;
  }
  return trimmed;
}

// Dotted-quad IPv4, octets 0-255 without leading zeros (Zod's `ipv4`)
function fastValidateIpv4(s: string): boolean {
  const len = s.length;
  if (len < 7 || len > 15) return false;

  let parts = 0;
  let current = 0;
  let digits = 0;

  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);
    if (c >= 48 && c <= 57) {
      if (digits === 1 && current === 0) return false; // leading zero
      current = current * 10 + c - 48;
      if (++digits > 3 || current > 255) return false;
    } else if (c === 46) {
      if (digits === 0 || ++parts > 3) return false;
      current = 0;
      digits = 0;
    } else {
      return false;
    }
  }

  return parts === 3 && digits > 0;
}

// Zod 4 JWT check: 3 dot-separated parts, header decodes to JSON with `alg`
function isValidJWT(token: string, algorithm?: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const header = parts[0];
    if (!header) return false;
    const parsedHeader = JSON.parse(atob(header));
    if (typeof parsedHeader !== 'object' || parsedHeader === null) return false;
    if ('typ' in parsedHeader && parsedHeader.typ !== 'JWT') return false;
    if (!parsedHeader.alg) return false;
    if (algorithm && parsedHeader.alg !== algorithm) return false;
    return true;
  } catch {
    return false;
  }
}

// Shared empty path for optimistic (no-error) parsing - avoids allocation
const EMPTY_PATH: (string | number)[] = [];

// JSON Schema generation mode for the call in progress (see DhiType.toJsonSchema)
let _jsonSchemaIo: 'input' | 'output' = 'output';

// ============================================================================
// Type System - Full Zod 4 Compatible Types
// ============================================================================

/** Extract the output type from a schema */
export type infer<T extends DhiType<any, any>> = T["_output"];

/** Extract the input type from a schema */
export type input<T extends DhiType<any, any>> = T["_input"];

/** Extract the output type */
export type output<T extends DhiType<any, any>> = T["_output"];

/** Utility: make all properties optional */
type Partial_<T> = { [K in keyof T]?: T[K] };

/** Utility: make all properties required */
type Required_<T> = { [K in keyof T]-?: T[K] };

/** Utility: pick specific keys */
type Pick_<T, K extends keyof T> = { [P in K]: T[P] };

/** Utility: omit specific keys */
type Omit_<T, K extends keyof T> = { [P in Exclude<keyof T, K>]: T[P] };

/** Infer object shape from schema shape */
type InferShape<T extends Record<string, DhiType<any, any>>> = {
  [K in keyof T]: T[K]["_output"];
};

type InferInputShape<T extends Record<string, DhiType<any, any>>> = {
  [K in keyof T]: T[K]["_input"];
};

/** Make optional keys actually optional in the type (`.optional()`, `.exactOptional()`, undefined-accepting schemas) */
type OptionalKeys<T extends Record<string, DhiType<any, any>>> = {
  [K in keyof T]: T[K] extends { _optionalKey: true } ? K : undefined extends T[K]["_output"] ? K : never;
}[keyof T];

type RequiredKeys<T extends Record<string, DhiType<any, any>>> = Exclude<keyof T, OptionalKeys<T>>;

type InferObjectOutput<T extends Record<string, DhiType<any, any>>> =
  { [K in RequiredKeys<T> & string]: T[K]["_output"] } &
  { [K in OptionalKeys<T> & string]?: T[K]["_output"] };

type InferObjectInput<T extends Record<string, DhiType<any, any>>> =
  { [K in RequiredKeys<T> & string]: T[K]["_input"] } &
  { [K in OptionalKeys<T> & string]?: T[K]["_input"] };

/** Collapse an intersection of mapped types into one flat object type (readable hovers, like Zod) */
type Flatten<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

/** Inferred output type of `z.object(shape)` */
export type ObjectOutput<T extends Record<string, DhiType<any, any>>> = Flatten<InferObjectOutput<T>>;

/** Inferred input type of `z.object(shape)` */
export type ObjectInput<T extends Record<string, DhiType<any, any>>> = Flatten<InferObjectInput<T>>;

// ============================================================================
// Error Types - Zod 4 Compatible
// ============================================================================

export type ZodIssueCode =
  | "invalid_type"
  | "invalid_literal"
  | "custom"
  | "invalid_union"
  | "invalid_union_discriminator"
  | "invalid_enum_value"
  | "unrecognized_keys"
  | "invalid_arguments"
  | "invalid_return_type"
  | "invalid_date"
  | "invalid_string"
  | "too_small"
  | "too_big"
  | "invalid_intersection_types"
  | "not_multiple_of"
  | "not_finite"
  // Zod 4 codes
  | "invalid_format"
  | "invalid_value"
  | "invalid_key"
  | "invalid_element";

export interface ZodIssue {
  code: ZodIssueCode;
  path: (string | number)[];
  message: string;
  expected?: string;
  received?: string;
  fatal?: boolean;
}

export class ZodError {
  issues: ZodIssue[];
  readonly name = "ZodError";

  constructor(issues: ZodIssue[]) {
    this.issues = issues;
  }

  get errors() { return this.issues; }

  get message() {
    return JSON.stringify(this.issues, null, 2);
  }

  format(): Record<string, any> {
    const fmt: Record<string, any> = { _errors: [] };
    for (const issue of this.issues) {
      if (issue.path.length === 0) {
        fmt._errors.push(issue.message);
      } else {
        let curr = fmt;
        for (const seg of issue.path) {
          if (!curr[seg]) curr[seg] = { _errors: [] };
          curr = curr[seg];
        }
        curr._errors.push(issue.message);
      }
    }
    return fmt;
  }

  flatten() {
    const fieldErrors: Record<string, string[]> = {};
    const formErrors: string[] = [];
    for (const issue of this.issues) {
      if (issue.path.length === 0) {
        formErrors.push(issue.message);
      } else {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
    }
    return { formErrors, fieldErrors };
  }
}

export type SafeParseResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: ZodError };

// ============================================================================
// Base Schema Type
// ============================================================================

// AI SDK compatibility symbol - allows Vercel AI SDK to detect dhi schemas
const schemaSymbol = Symbol.for("vercel.ai.schema");

export abstract class DhiType<Output = any, Input = Output> {
  readonly _output!: Output;
  readonly _input!: Input;
  _description?: string;
  _metadata?: Record<string, any>;

  // AI SDK compatibility marker - enables isSchema() detection
  readonly [schemaSymbol] = true;

  /**
   * Zod 4 core-compatible internals. Libraries that detect Zod 4 schemas via
   * `_zod` (MCP SDK, AI SDK, tRPC, Hono, zod-openapi, ...) can hand a dhi
   * schema to Zod's own core helpers (`safeParse`, `toJSONSchema`, shape
   * introspection) and get correct results. Built lazily on first access and
   * cached per instance — see the "Zod 4 core compatibility" section below.
   */
  get _zod(): ZodCompatInternals<Output, Input> {
    const internals = buildZodInternals(this);
    Object.defineProperty(this, '_zod', { value: internals, enumerable: false, configurable: true, writable: true });
    return internals;
  }

  /** Zod-style definition object (`_zod.def`, plus the Zod 3 `typeName` for legacy consumers) */
  get _def(): ZodCompatDef {
    return this._zod.def;
  }

  /** Zod 4 alias for `_def` */
  get def(): ZodCompatDef {
    return this._zod.def;
  }

  // Zod compatibility: _type property (inferred output type marker)
  // This is a type-level property in Zod, we provide it for structural compatibility
  get _type(): Output {
    return undefined as any;
  }

  // Zod compatibility: description getter
  get description(): string | undefined {
    return this._description;
  }

  // Standard Schema v1 compatibility - allows AI SDK and other tools to use dhi schemas
  // See: https://github.com/standard-schema/standard-schema
  // Implements both StandardSchemaV1 (validate) and StandardJSONSchemaV1 (jsonSchema)
  get '~standard'(): {
    version: 1;
    vendor: 'dhi';
    validate: (value: unknown) => Promise<{ value: Output } | { issues: Array<{ message: string; path?: Array<string | number> }> }>;
    jsonSchema: {
      input: (options: { target: string }) => Record<string, any>;
      output: (options: { target: string }) => Record<string, any>;
    };
    types?: { input: Input; output: Output };
  } {
    const self = this;
    return {
      version: 1,
      vendor: 'dhi',
      validate: async (value: unknown) => {
        const result = self.safeParse(value);
        if (result.success) {
          return { value: result.data };
        }
        return {
          issues: result.error.issues.map(issue => ({
            message: issue.message,
            path: issue.path,
          })),
        };
      },
      jsonSchema: {
        input: (_options: { target: string }) => self.toJsonSchema({ io: 'input' }),
        output: (_options: { target: string }) => self.toJsonSchema({ io: 'output' }),
      },
      types: undefined as any, // Type-level only, no runtime value needed
    };
  }

  abstract _parse(value: unknown, path: (string | number)[]): SafeParseResult<Output>;

  /**
   * Cheap, allocation-free validity probe used by unions to reject non-matching
   * members without building a ZodError per miss. Contract:
   *   true      -> definitely valid (caller still runs _parse to apply transforms)
   *   false     -> definitely invalid (skip; no allocation)
   *   undefined -> can't decide cheaply; caller falls back to _parse
   * Default is conservative (undefined). Leaf types override for the fast reject.
   */
  _fastValid(_value: unknown): boolean | undefined {
    return undefined;
  }

  parse(value: unknown): Output {
    // EMPTY_PATH is shared & never mutated (child paths use [...path, key]), so
    // reusing it avoids a fresh array allocation on every top-level call.
    const result = this._parse(value, EMPTY_PATH);
    if (!result.success) throw result.error;
    return result.data;
  }

  safeParse(value: unknown): SafeParseResult<Output> {
    return this._parse(value, EMPTY_PATH);
  }

  async parseAsync(value: unknown): Promise<Output> {
    return this.parse(value);
  }

  async safeParseAsync(value: unknown): Promise<SafeParseResult<Output>> {
    return this.safeParse(value);
  }

  optional(): DhiOptional<this> {
    return new DhiOptional(this);
  }

  nullable(): DhiNullable<this> {
    return new DhiNullable(this);
  }

  nullish(): DhiOptional<DhiNullable<this>> {
    return new DhiOptional(new DhiNullable(this));
  }

  default(defaultValue: Output | (() => Output)): DhiDefault<this> {
    return new DhiDefault(this, defaultValue);
  }

  catch(catchValue: Output | (() => Output)): DhiCatch<this> {
    return new DhiCatch(this, catchValue);
  }

  transform<U>(fn: (value: Output) => U): DhiTransform<this, U> {
    return new DhiTransform(this, fn);
  }

  refine(check: (value: Output) => boolean, message?: string | { message?: string; path?: (string | number)[] }): DhiRefine<this> {
    const msg = typeof message === 'string' ? message : message?.message;
    const path = typeof message === 'object' ? message?.path : undefined;
    return new DhiRefine(this, check, msg, path);
  }

  superRefine(refinement: (value: Output, ctx: { addIssue: (issue: Partial<ZodIssue>) => void }) => void): DhiSuperRefine<this> {
    return new DhiSuperRefine(this, refinement);
  }

  pipe<T extends DhiType<any, Output>>(schema: T): DhiPipe<this, T> {
    return new DhiPipe(this, schema);
  }

  or<T extends DhiType<any, any>>(other: T): DhiUnion<[this, T]> {
    return new DhiUnion([this, other]);
  }

  and<T extends DhiType<any, any>>(other: T): DhiIntersection<this, T> {
    return new DhiIntersection(this, other);
  }

  array(): DhiArray<this> {
    return new DhiArray(this);
  }

  readonly(): DhiReadonly<this> {
    return new DhiReadonly(this);
  }

  brand<B extends string>(): DhiType<Output & { __brand: B }, Input> {
    return this as any;
  }

  describe(description: string): this {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone._description = description;
    return clone;
  }

  meta(metadata: Record<string, any>): this {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone._metadata = { ...this._metadata, ...metadata };
    return clone;
  }

  /** Zod 4 semantics: true when `undefined` is accepted (optional, default, catch, any, ...) */
  isOptional(): boolean {
    return this.safeParse(undefined).success;
  }

  /** Zod 4 semantics: true when `null` is accepted */
  isNullable(): boolean {
    return this.safeParse(null).success;
  }

  /**
   * Zod 4: nonoptional — removes optionality (`undefined` is rejected).
   * Typed against the base `DhiType<Output, Input>` rather than `this`: the
   * `Exclude<this["_output"], undefined>` form makes tsc explore an unbounded
   * chain of nested instantiations when relating schema types.
   */
  nonoptional(): DhiNonOptional<DhiType<Output, Input>> {
    return new DhiNonOptional(this as DhiType<Output, Input>);
  }

  /** Zod 4: exactOptional — key may be absent, but an explicit `undefined` is rejected */
  exactOptional(): DhiExactOptional<this> {
    return new DhiExactOptional(this);
  }

  /**
   * Zod 4 `.check(...)`: attach checks. Accepts check functions that receive the
   * parse payload (`{ value, issues }` — push an issue to reject, reassign
   * `value` to overwrite), Zod-style check objects (`z.lowercase()`,
   * `z.minLength(3)`, `z.overwrite(fn)`, or a real Zod 4 check) and, for
   * backwards compatibility, superRefine-style `(value, ctx) => void` callbacks.
   */
  check(...checks: Array<DhiCheckInput<Output>>): DhiCheck<this> {
    return new DhiCheck(this, checks);
  }

  // Zod 4: overwrite - transform without changing inferred type
  overwrite(fn: (value: Output) => Output): DhiTransform<this, Output> {
    return new DhiTransform(this, fn) as any;
  }

  // Zod 4: prefault - default that gets processed by subsequent transforms
  prefault(defaultValue: Input | (() => Input)): DhiDefault<this> {
    return new DhiDefault(this, defaultValue as any);
  }

  // Zod 4: clone
  clone(): this {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    return clone;
  }

  /**
   * Zod-style immutability for check builders: `z.string().min(3)` returns a
   * new schema and leaves the receiver untouched, so a shared base schema can
   * be specialised safely. Compiled JIT validators are dropped from the copy
   * and rebuilt lazily against the new check list.
   */
  protected _withCheck(check: Record<string, any>): this {
    const clone: any = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.checks = [...((this as any).checks ?? []), check];
    if ('_jit' in clone) clone._jit = undefined;
    if ('_jitTop' in clone) clone._jitTop = undefined;
    return clone;
  }

  // JSON Schema generation - override in subclasses
  /**
   * JSON Schema for this schema. `io: 'output'` (the default, like Zod)
   * describes parsed values, so keys with `.default()` are required;
   * `io: 'input'` describes accepted input, so `.default()` / `.catch()` keys
   * are optional. Nested schemas inherit the mode.
   */
  toJsonSchema(opts?: { io?: 'input' | 'output' }): Record<string, any> {
    const io = opts?.io ?? _jsonSchemaIo;
    if (io !== _jsonSchemaIo) {
      const prev = _jsonSchemaIo;
      _jsonSchemaIo = io;
      try {
        return this.toJsonSchema();
      } finally {
        _jsonSchemaIo = prev;
      }
    }
    const schema: Record<string, any> = this._toJsonSchemaCore();
    if (this._description) {
      schema.description = this._description;
    }
    return schema;
  }

  // Alias for toJsonSchema (for compatibility)
  json(): Record<string, any> {
    return this.toJsonSchema();
  }

  // Getter for AI SDK compatibility - Vercel AI SDK expects .jsonSchema property
  get jsonSchema(): Record<string, any> {
    return this.toJsonSchema();
  }

  // AI SDK compatibility: validate function expected by isSchema() check
  validate(value: unknown): SafeParseResult<Output> {
    return this.safeParse(value);
  }

  // Override in subclasses to provide type-specific schema
  protected _toJsonSchemaCore(): Record<string, any> {
    return {};
  }
}

// ============================================================================
// Primitive Schemas
// ============================================================================

export class DhiString extends DhiType<string, string> {
  private checks: Array<{ type: string; value?: any; message?: string; position?: number }> = [];

  _fastValid(value: unknown): boolean | undefined {
    if (typeof value !== 'string') return false;
    return this.checks.length === 0 ? true : undefined;
  }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<string> {
    if (typeof value !== 'string') {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected string, received ' + typeof value, expected: 'string', received: typeof value }]) };
    }

    let current: string = value;
    const checks = this.checks;
    if (checks.length === 0) return { success: true, data: current };

    for (let ci = 0; ci < checks.length; ci++) {
      const check = checks[ci];
      switch (check.type) {
        case 'min':
          if (current.length < check.value)
            return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `String must contain at least ${check.value} character(s)` }]) };
          break;
        case 'max':
          if (current.length > check.value)
            return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || `String must contain at most ${check.value} character(s)` }]) };
          break;
        case 'length':
          if (current.length !== check.value)
            return { success: false, error: new ZodError([{ code: current.length < check.value ? 'too_small' : 'too_big', path, message: check.message || `String must contain exactly ${check.value} character(s)` }]) };
          break;
        case 'email':
          if (!fastValidateEmail(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid email address' }]) };
          break;
        case 'url': {
          const normalized = validateUrl(current, check.value);
          if (normalized === null)
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid URL' }]) };
          current = normalized;
          break;
        }
        case 'uuid':
          if (!fastValidateUuid(current, check.value))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid UUID' }]) };
          break;
        case 'guid':
          if (!fastValidateGuid(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid GUID' }]) };
          break;
        case 'cuid':
          if (!CUID_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid cuid' }]) };
          break;
        case 'cuid2':
          if (!CUID2_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid cuid2' }]) };
          break;
        case 'ulid':
          if (!ULID_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid ULID' }]) };
          break;
        case 'emoji':
          if (!EMOJI_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid emoji' }]) };
          break;
        case 'ipv4':
          if (!fastValidateIpv4(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid IPv4 address' }]) };
          break;
        case 'ipv6':
          if (!fastValidateIpv6(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid IPv6 address' }]) };
          break;
        case 'ip':
          if (!fastValidateIpv4(current) && !fastValidateIpv6(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid IP address' }]) };
          break;
        case 'base64':
          if (!fastValidateBase64(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid base64-encoded string' }]) };
          break;
        case 'base64url':
          if (!fastValidateBase64Url(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid base64url-encoded string' }]) };
          break;
        case 'datetime':
          if (!check.value.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid ISO datetime' }]) };
          break;
        case 'date':
          if (!fastValidateDate(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid ISO date' }]) };
          break;
        case 'time':
          if (!check.value.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid ISO time' }]) };
          break;
        case 'duration':
          if (!ISO_DURATION_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid ISO duration' }]) };
          break;
        case 'regex':
          check.value.lastIndex = 0;
          if (!check.value.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid string: must match pattern ' + check.value.source }]) };
          break;
        case 'includes':
          if (!current.includes(check.value, check.position))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || `Invalid string: must include "${check.value}"` }]) };
          break;
        case 'startsWith':
          if (!current.startsWith(check.value))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || `Invalid string: must start with "${check.value}"` }]) };
          break;
        case 'endsWith':
          if (!current.endsWith(check.value))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || `Invalid string: must end with "${check.value}"` }]) };
          break;
        case 'trim':
          current = current.trim();
          break;
        case 'toLowerCase':
          current = current.toLowerCase();
          break;
        case 'toUpperCase':
          current = current.toUpperCase();
          break;
        case 'nonempty':
          if (current.length === 0)
            return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || 'String must contain at least 1 character(s)' }]) };
          break;
        // Zod 4: lowercase()/uppercase() VALIDATE case (use toLowerCase()/toUpperCase() to transform)
        case 'lowercase':
          if (!LOWERCASE_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid lowercase string' }]) };
          break;
        case 'uppercase':
          if (!UPPERCASE_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid uppercase string' }]) };
          break;
        case 'normalize':
          current = current.normalize(check.value || 'NFC');
          break;
        case 'slugify':
          current = current.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          break;
        case 'jwt':
          if (!isValidJWT(current, check.value))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid JWT' }]) };
          break;
        case 'nanoid':
          if (!NANOID_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid nanoid' }]) };
          break;
        case 'cidrv4':
          if (!CIDRV4_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid IPv4 range' }]) };
          break;
        case 'cidrv6':
          if (!fastValidateCidrv6(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid IPv6 range' }]) };
          break;
        case 'e164':
          if (!E164_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid E.164 number' }]) };
          break;
        case 'mac':
          if (!check.value.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid MAC address' }]) };
          break;
        case 'xid':
          if (!XID_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid XID' }]) };
          break;
        case 'ksuid':
          if (!KSUID_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid KSUID' }]) };
          break;
        case 'hostname':
          if (!HOSTNAME_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid hostname' }]) };
          break;
        case 'hex':
          if (!HEX_RE.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid hexadecimal string' }]) };
          break;
        case 'hash':
          if (!check.value.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid hash' }]) };
          break;
      }
    }

    return { success: true, data: current };
  }

  min(length: number, message?: ZodMessage): this { return this._withCheck({ type: 'min', value: length, message: msgOf(message) }); }
  max(length: number, message?: ZodMessage): this { return this._withCheck({ type: 'max', value: length, message: msgOf(message) }); }
  length(length: number, message?: ZodMessage): this { return this._withCheck({ type: 'length', value: length, message: msgOf(message) }); }
  email(message?: ZodMessage): this { return this._withCheck({ type: 'email', message: msgOf(message) }); }
  /**
   * Zod 4 URL validation: any WHATWG-parsable URL (`new URL(value)`), optionally
   * constrained by `hostname` / `protocol` regexes. Whitespace is trimmed and, with
   * `normalize: true`, the output is the normalized `url.href`.
   */
  url(opts?: ZodMessage | { message?: string; error?: string; hostname?: RegExp; protocol?: RegExp; normalize?: boolean }): this {
    const o = (typeof opts === 'object' && opts !== null ? opts : undefined) as { message?: string; error?: string; hostname?: RegExp; protocol?: RegExp; normalize?: boolean } | undefined;
    return this._withCheck({ type: 'url', value: o ? { hostname: o.hostname, protocol: o.protocol, normalize: o.normalize } : undefined, message: msgOf(opts) });
  }
  uuid(message?: ZodMessage): this { return this._withCheck({ type: 'uuid', message: msgOf(message) }); }
  uuidv4(message?: ZodMessage): this { return this._withCheck({ type: 'uuid', value: 4, message: msgOf(message) }); }
  uuidv6(message?: ZodMessage): this { return this._withCheck({ type: 'uuid', value: 6, message: msgOf(message) }); }
  uuidv7(message?: ZodMessage): this { return this._withCheck({ type: 'uuid', value: 7, message: msgOf(message) }); }
  /** Any 8-4-4-4-12 hex identifier (no RFC 9562 version/variant check) — Zod's `z.guid()` */
  guid(message?: ZodMessage): this { return this._withCheck({ type: 'guid', message: msgOf(message) }); }
  cuid(message?: ZodMessage): this { return this._withCheck({ type: 'cuid', message: msgOf(message) }); }
  cuid2(message?: ZodMessage): this { return this._withCheck({ type: 'cuid2', message: msgOf(message) }); }
  ulid(message?: ZodMessage): this { return this._withCheck({ type: 'ulid', message: msgOf(message) }); }
  emoji(message?: ZodMessage): this { return this._withCheck({ type: 'emoji', message: msgOf(message) }); }
  ip(message?: ZodMessage): this { return this._withCheck({ type: 'ip', message: msgOf(message) }); }
  ipv4(message?: ZodMessage): this { return this._withCheck({ type: 'ipv4', message: msgOf(message) }); }
  ipv6(message?: ZodMessage): this { return this._withCheck({ type: 'ipv6', message: msgOf(message) }); }
  base64(message?: ZodMessage): this { return this._withCheck({ type: 'base64', message: msgOf(message) }); }
  /**
   * ISO 8601 datetime. Zod 4 semantics: `Z` suffix required unless `offset: true`
   * (allow `±HH:MM`) or `local: true` (allow no timezone); `precision` fixes the
   * number of fractional-second digits (-1 = no seconds, 0 = no fraction).
   */
  datetime(opts?: ZodMessage | { message?: string; error?: string; offset?: boolean; local?: boolean; precision?: number | null }): this {
    const o = (typeof opts === 'object' && opts !== null ? opts : undefined) as { offset?: boolean; local?: boolean; precision?: number | null } | undefined;
    return this._withCheck({ type: 'datetime', value: isoDatetimeRegex(o), message: msgOf(opts) });
  }
  date(message?: ZodMessage): this { return this._withCheck({ type: 'date', message: msgOf(message) }); }
  time(opts?: ZodMessage | { message?: string; error?: string; precision?: number | null }): this {
    const o = (typeof opts === 'object' && opts !== null ? opts : undefined) as { precision?: number | null } | undefined;
    return this._withCheck({ type: 'time', value: isoTimeRegex(o), message: msgOf(opts) });
  }
  duration(message?: ZodMessage): this { return this._withCheck({ type: 'duration', message: msgOf(message) }); }
  regex(pattern: RegExp, message?: ZodMessage): this { return this._withCheck({ type: 'regex', value: pattern, message: msgOf(message) }); }
  includes(substr: string, opts?: ZodMessage | { message?: string; error?: string; position?: number }): this {
    const o = (typeof opts === 'object' && opts !== null ? opts : undefined) as { position?: number } | undefined;
    return this._withCheck({ type: 'includes', value: substr, message: msgOf(opts), position: o?.position });
  }
  startsWith(prefix: string, message?: ZodMessage): this { return this._withCheck({ type: 'startsWith', value: prefix, message: msgOf(message) }); }
  endsWith(suffix: string, message?: ZodMessage): this { return this._withCheck({ type: 'endsWith', value: suffix, message: msgOf(message) }); }
  trim(): this { return this._withCheck({ type: 'trim' }); }
  toLowerCase(): this { return this._withCheck({ type: 'toLowerCase' }); }
  toUpperCase(): this { return this._withCheck({ type: 'toUpperCase' }); }
  normalize(form?: string): this { return this._withCheck({ type: 'normalize', value: form || 'NFC' }); }
  slugify(): this { return this._withCheck({ type: 'slugify' }); }
  nonempty(message?: ZodMessage): this { return this._withCheck({ type: 'nonempty', message: msgOf(message) }); }

  // Zod 4: case VALIDATORS (not transforms — use toLowerCase()/toUpperCase() for that)
  lowercase(message?: ZodMessage): this { return this._withCheck({ type: 'lowercase', message: msgOf(message) }); }
  uppercase(message?: ZodMessage): this { return this._withCheck({ type: 'uppercase', message: msgOf(message) }); }

  // Zod 4: additional format validators
  jwt(opts?: ZodMessage | { message?: string; error?: string; alg?: string }): this {
    const o = (typeof opts === 'object' && opts !== null ? opts : undefined) as { alg?: string } | undefined;
    return this._withCheck({ type: 'jwt', value: o?.alg, message: msgOf(opts) });
  }
  nanoid(message?: ZodMessage): this { return this._withCheck({ type: 'nanoid', message: msgOf(message) }); }
  base64url(message?: ZodMessage): this { return this._withCheck({ type: 'base64url', message: msgOf(message) }); }
  cidrv4(message?: ZodMessage): this { return this._withCheck({ type: 'cidrv4', message: msgOf(message) }); }
  cidrv6(message?: ZodMessage): this { return this._withCheck({ type: 'cidrv6', message: msgOf(message) }); }
  e164(message?: ZodMessage): this { return this._withCheck({ type: 'e164', message: msgOf(message) }); }
  mac(opts?: ZodMessage | { message?: string; error?: string; delimiter?: string }): this {
    const o = (typeof opts === 'object' && opts !== null ? opts : undefined) as { delimiter?: string } | undefined;
    return this._withCheck({ type: 'mac', value: macRegex(o?.delimiter), message: msgOf(opts) });
  }
  xid(message?: ZodMessage): this { return this._withCheck({ type: 'xid', message: msgOf(message) }); }
  ksuid(message?: ZodMessage): this { return this._withCheck({ type: 'ksuid', message: msgOf(message) }); }
  hostname(message?: ZodMessage): this { return this._withCheck({ type: 'hostname', message: msgOf(message) }); }
  hex(message?: ZodMessage): this { return this._withCheck({ type: 'hex', message: msgOf(message) }); }
  hash(algorithm: 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512', opts?: ZodMessage | { message?: string; error?: string; enc?: 'hex' | 'base64' | 'base64url' }): this {
    const o = (typeof opts === 'object' && opts !== null ? opts : undefined) as { enc?: 'hex' | 'base64' | 'base64url' } | undefined;
    return this._withCheck({ type: 'hash', value: hashRegex(algorithm, o?.enc), message: msgOf(opts) });
  }

  // Zod 4 aliases
  minLength(length: number, message?: ZodMessage): this { return this.min(length, message); }
  maxLength(length: number, message?: ZodMessage): this { return this.max(length, message); }

  /** @internal Zod 4 `_zod.def` view of the accumulated checks */
  _zodChecks(): any[] {
    const out: any[] = [];
    for (const c of this.checks) {
      switch (c.type) {
        case 'min': out.push(zodCheck('min_length', { minimum: c.value }, c.message)); break;
        case 'max': out.push(zodCheck('max_length', { maximum: c.value }, c.message)); break;
        case 'length': out.push(zodCheck('length_equals', { length: c.value }, c.message)); break;
        case 'nonempty': out.push(zodCheck('min_length', { minimum: 1 }, c.message)); break;
        case 'regex': out.push(zodCheck('string_format', { format: 'regex', pattern: c.value }, c.message)); break;
        case 'includes': out.push(zodCheck('string_format', { format: 'includes', includes: c.value, position: c.position }, c.message)); break;
        case 'startsWith': out.push(zodCheck('string_format', { format: 'starts_with', prefix: c.value }, c.message)); break;
        case 'endsWith': out.push(zodCheck('string_format', { format: 'ends_with', suffix: c.value }, c.message)); break;
        case 'trim': out.push(zodCheck('overwrite', { tx: (v: string) => v.trim() })); break;
        case 'toLowerCase': out.push(zodCheck('overwrite', { tx: (v: string) => v.toLowerCase() })); break;
        case 'toUpperCase': out.push(zodCheck('overwrite', { tx: (v: string) => v.toUpperCase() })); break;
        case 'normalize': out.push(zodCheck('overwrite', { tx: (v: string) => v.normalize(c.value || 'NFC') })); break;
        case 'slugify': out.push(zodCheck('overwrite', { tx: (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })); break;
        default: out.push(zodCheck('string_format', { format: ZOD_FORMAT_NAMES[c.type] ?? c.type }, c.message)); break;
      }
    }
    return out;
  }

  /** @internal First string format check (Zod 4 `def.format`) */
  _zodFormat(): string | undefined {
    for (const c of this.checks) {
      const f = ZOD_FORMAT_NAMES[c.type];
      if (f !== undefined) return f;
    }
    return undefined;
  }

  protected _toJsonSchemaCore(): Record<string, any> {
    const schema: Record<string, any> = { type: 'string' };
    for (const check of this.checks) {
      switch (check.type) {
        case 'min': schema.minLength = check.value; break;
        case 'max': schema.maxLength = check.value; break;
        case 'length': schema.minLength = schema.maxLength = check.value; break;
        case 'nonempty': schema.minLength = Math.max(schema.minLength ?? 0, 1); break;
        case 'email': schema.format = 'email'; break;
        case 'url': schema.format = 'uri'; break;
        case 'uuid': case 'guid': schema.format = 'uuid'; break;
        case 'datetime': schema.format = 'date-time'; break;
        case 'date': schema.format = 'date'; break;
        case 'time': schema.format = 'time'; break;
        case 'duration': schema.format = 'duration'; break;
        case 'ipv4': schema.format = 'ipv4'; break;
        case 'ipv6': schema.format = 'ipv6'; break;
        case 'hostname': schema.format = 'hostname'; break;
        case 'base64': schema.contentEncoding = 'base64'; break;
        case 'regex': schema.pattern = check.value.source; break;
      }
    }
    return schema;
  }
}

export class DhiNumber extends DhiType<number, number> {
  private checks: Array<{ type: string; value?: any; message?: string }> = [];

  _fastValid(value: unknown): boolean | undefined {
    // Zod 4: NaN and ±Infinity are not numbers (`v - v !== 0` is true for all three)
    if (typeof value !== 'number' || value - value !== 0) return false;
    return this.checks.length === 0 ? true : undefined;
  }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<number> {
    if (typeof value !== 'number' || value - value !== 0) {
      const received = typeof value === 'number' ? (value !== value ? 'NaN' : 'Infinity') : typeof value;
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected number, received ' + received, expected: 'number', received }]) };
    }

    const checks = this.checks;
    for (let ci = 0; ci < checks.length; ci++) {
      const check = checks[ci];
      switch (check.type) {
        case 'min':
        case 'gte':
          if (value < check.value)
            return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `Number must be greater than or equal to ${check.value}` }]) };
          break;
        case 'max':
        case 'lte':
          if (value > check.value)
            return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || `Number must be less than or equal to ${check.value}` }]) };
          break;
        case 'gt':
          if (value <= check.value)
            return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `Number must be greater than ${check.value}` }]) };
          break;
        case 'lt':
          if (value >= check.value)
            return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || `Number must be less than ${check.value}` }]) };
          break;
        case 'int':
          // Zod 4: .int() means "safe integer" (Number.MIN_SAFE_INTEGER..MAX_SAFE_INTEGER)
          if (!Number.isInteger(value))
            return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: check.message || 'Expected integer, received float' }]) };
          if (!Number.isSafeInteger(value))
            return { success: false, error: new ZodError([{ code: value > 0 ? 'too_big' : 'too_small', path, message: check.message || (value > 0 ? `Number must be less than or equal to ${Number.MAX_SAFE_INTEGER}` : `Number must be greater than or equal to ${Number.MIN_SAFE_INTEGER}`) }]) };
          break;
        case 'positive':
          if (value <= 0)
            return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || 'Number must be greater than 0' }]) };
          break;
        case 'negative':
          if (value >= 0)
            return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || 'Number must be less than 0' }]) };
          break;
        case 'nonnegative':
          if (value < 0)
            return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || 'Number must be greater than or equal to 0' }]) };
          break;
        case 'nonpositive':
          if (value > 0)
            return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || 'Number must be less than or equal to 0' }]) };
          break;
        case 'multipleOf':
        case 'step':
          if (!isMultipleOf(value, check.value))
            return { success: false, error: new ZodError([{ code: 'not_multiple_of', path, message: check.message || `Number must be a multiple of ${check.value}` }]) };
          break;
        case 'finite':
          // Always true: non-finite values are rejected by the type check above (Zod 4 semantics)
          break;
        case 'safe':
          if (!Number.isSafeInteger(value))
            return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: check.message || 'Number must be a safe integer' }]) };
          break;
      }
    }

    return { success: true, data: value };
  }

  min(value: number, message?: ZodMessage): this { return this._withCheck({ type: 'min', value, message: msgOf(message) }); }
  max(value: number, message?: ZodMessage): this { return this._withCheck({ type: 'max', value, message: msgOf(message) }); }
  gt(value: number, message?: ZodMessage): this { return this._withCheck({ type: 'gt', value, message: msgOf(message) }); }
  gte(value: number, message?: ZodMessage): this { return this._withCheck({ type: 'gte', value, message: msgOf(message) }); }
  lt(value: number, message?: ZodMessage): this { return this._withCheck({ type: 'lt', value, message: msgOf(message) }); }
  lte(value: number, message?: ZodMessage): this { return this._withCheck({ type: 'lte', value, message: msgOf(message) }); }
  int(message?: ZodMessage): this { return this._withCheck({ type: 'int', message: msgOf(message) }); }
  positive(message?: ZodMessage): this { return this._withCheck({ type: 'positive', message: msgOf(message) }); }
  negative(message?: ZodMessage): this { return this._withCheck({ type: 'negative', message: msgOf(message) }); }
  nonnegative(message?: ZodMessage): this { return this._withCheck({ type: 'nonnegative', message: msgOf(message) }); }
  nonpositive(message?: ZodMessage): this { return this._withCheck({ type: 'nonpositive', message: msgOf(message) }); }
  multipleOf(value: number, message?: ZodMessage): this { return this._withCheck({ type: 'multipleOf', value, message: msgOf(message) }); }
  step(value: number, message?: ZodMessage): this { return this._withCheck({ type: 'step', value, message: msgOf(message) }); }
  finite(message?: ZodMessage): this { return this._withCheck({ type: 'finite', message: msgOf(message) }); }
  safe(message?: ZodMessage): this { return this._withCheck({ type: 'safe', message: msgOf(message) }); }

  // Zod 4 aliases
  minimum(value: number, message?: ZodMessage): this { return this.gte(value, message); }
  maximum(value: number, message?: ZodMessage): this { return this.lte(value, message); }

  /** @internal Zod 4 `_zod.def` view of the accumulated checks */
  _zodChecks(): any[] {
    const out: any[] = [];
    for (const c of this.checks) {
      switch (c.type) {
        case 'min': case 'gte': out.push(zodCheck('greater_than', { value: c.value, inclusive: true }, c.message)); break;
        case 'gt': out.push(zodCheck('greater_than', { value: c.value, inclusive: false }, c.message)); break;
        case 'max': case 'lte': out.push(zodCheck('less_than', { value: c.value, inclusive: true }, c.message)); break;
        case 'lt': out.push(zodCheck('less_than', { value: c.value, inclusive: false }, c.message)); break;
        case 'positive': out.push(zodCheck('greater_than', { value: 0, inclusive: false }, c.message)); break;
        case 'negative': out.push(zodCheck('less_than', { value: 0, inclusive: false }, c.message)); break;
        case 'nonnegative': out.push(zodCheck('greater_than', { value: 0, inclusive: true }, c.message)); break;
        case 'nonpositive': out.push(zodCheck('less_than', { value: 0, inclusive: true }, c.message)); break;
        case 'int': case 'safe': out.push(zodCheck('number_format', { format: 'safeint' }, c.message)); break;
        case 'multipleOf': case 'step': out.push(zodCheck('multiple_of', { value: c.value }, c.message)); break;
      }
    }
    return out;
  }

  protected _toJsonSchemaCore(): Record<string, any> {
    let isInt = false;
    const schema: Record<string, any> = { type: 'number' };
    for (const check of this.checks) {
      switch (check.type) {
        case 'int': case 'safe': isInt = true; break;
        case 'min': case 'gte': schema.minimum = check.value; break;
        case 'max': case 'lte': schema.maximum = check.value; break;
        case 'gt': schema.exclusiveMinimum = check.value; break;
        case 'lt': schema.exclusiveMaximum = check.value; break;
        case 'positive': schema.exclusiveMinimum = 0; break;
        case 'negative': schema.exclusiveMaximum = 0; break;
        case 'nonnegative': schema.minimum = 0; break;
        case 'nonpositive': schema.maximum = 0; break;
        case 'multipleOf': case 'step': schema.multipleOf = check.value; break;
      }
    }
    if (isInt) schema.type = 'integer';
    return schema;
  }
}

export class DhiBigInt extends DhiType<bigint, bigint> {
  private checks: Array<{ type: string; value?: any; message?: string }> = [];

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<bigint> {
    if (typeof value !== 'bigint') {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected bigint, received ' + typeof value }]) };
    }

    for (const check of this.checks) {
      switch (check.type) {
        case 'min':
        case 'gte':
          if (value < check.value) return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `Value too small` }]) };
          break;
        case 'max':
        case 'lte':
          if (value > check.value) return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || `Value too big` }]) };
          break;
        case 'gt':
          if (value <= check.value) return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `Value too small` }]) };
          break;
        case 'lt':
          if (value >= check.value) return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || `Value too big` }]) };
          break;
        case 'positive':
          if (value <= 0n) return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `Must be positive` }]) };
          break;
        case 'negative':
          if (value >= 0n) return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || `Must be negative` }]) };
          break;
        case 'nonnegative':
          if (value < 0n) return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `Must be non-negative` }]) };
          break;
        case 'nonpositive':
          if (value > 0n) return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || `Must be non-positive` }]) };
          break;
        case 'multipleOf':
          if (value % check.value !== 0n) return { success: false, error: new ZodError([{ code: 'not_multiple_of', path, message: check.message || `Not a multiple` }]) };
          break;
      }
    }

    return { success: true, data: value };
  }

  min(value: bigint, message?: string): this { return this._withCheck({ type: 'min', value, message }); }
  max(value: bigint, message?: string): this { return this._withCheck({ type: 'max', value, message }); }
  gt(value: bigint, message?: string): this { return this._withCheck({ type: 'gt', value, message }); }
  gte(value: bigint, message?: string): this { return this._withCheck({ type: 'gte', value, message }); }
  lt(value: bigint, message?: string): this { return this._withCheck({ type: 'lt', value, message }); }
  lte(value: bigint, message?: string): this { return this._withCheck({ type: 'lte', value, message }); }
  positive(message?: string): this { return this._withCheck({ type: 'positive', message }); }
  negative(message?: string): this { return this._withCheck({ type: 'negative', message }); }
  nonnegative(message?: string): this { return this._withCheck({ type: 'nonnegative', message }); }
  nonpositive(message?: string): this { return this._withCheck({ type: 'nonpositive', message }); }
  multipleOf(value: bigint, message?: string): this { return this._withCheck({ type: 'multipleOf', value, message }); }
}

export class DhiBoolean extends DhiType<boolean, boolean> {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<boolean> {
    if (typeof value !== 'boolean') {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected boolean, received ' + typeof value }]) };
    }
    return { success: true, data: value };
  }

  _fastValid(value: unknown): boolean { return typeof value === 'boolean'; }

  protected _toJsonSchemaCore(): Record<string, any> {
    return { type: 'boolean' };
  }
}

export class DhiDate extends DhiType<Date, Date> {
  private checks: Array<{ type: string; value?: any; message?: string }> = [];

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<Date> {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
      return { success: false, error: new ZodError([{ code: 'invalid_date', path, message: 'Invalid date' }]) };
    }

    for (const check of this.checks) {
      switch (check.type) {
        case 'min':
          if (value.getTime() < check.value.getTime())
            return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || 'Date too early' }]) };
          break;
        case 'max':
          if (value.getTime() > check.value.getTime())
            return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || 'Date too late' }]) };
          break;
      }
    }

    return { success: true, data: value };
  }

  min(date: Date, message?: string): this { return this._withCheck({ type: 'min', value: date, message }); }
  max(date: Date, message?: string): this { return this._withCheck({ type: 'max', value: date, message }); }

  protected _toJsonSchemaCore(): Record<string, any> {
    return { type: 'string', format: 'date-time' };
  }
}

export class DhiSymbol extends DhiType<symbol, symbol> {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<symbol> {
    if (typeof value !== 'symbol') {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected symbol' }]) };
    }
    return { success: true, data: value };
  }
}

export class DhiUndefined extends DhiType<undefined, undefined> {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<undefined> {
    if (value !== undefined) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected undefined' }]) };
    }
    return { success: true, data: undefined };
  }

  _fastValid(value: unknown): boolean { return value === undefined; }
}

export class DhiNull extends DhiType<null, null> {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<null> {
    if (value !== null) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected null' }]) };
    }
    return { success: true, data: null };
  }

  _fastValid(value: unknown): boolean { return value === null; }

  protected _toJsonSchemaCore(): Record<string, any> {
    return { type: 'null' };
  }
}

export class DhiVoid extends DhiType<void, void> {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<void> {
    if (value !== undefined) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected void' }]) };
    }
    return { success: true, data: undefined };
  }
}

export class DhiNever extends DhiType<never, never> {
  _parse(_value: unknown, path: (string | number)[]): SafeParseResult<never> {
    return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected never' }]) };
  }
}

export class DhiAny extends DhiType<any, any> {
  _parse(value: unknown, _path: (string | number)[]): SafeParseResult<any> {
    return { success: true, data: value };
  }

  protected _toJsonSchemaCore(): Record<string, any> {
    return {}; // Empty schema accepts anything
  }
}

export class DhiUnknown extends DhiType<unknown, unknown> {
  _parse(value: unknown, _path: (string | number)[]): SafeParseResult<unknown> {
    return { success: true, data: value };
  }

  protected _toJsonSchemaCore(): Record<string, any> {
    return {}; // Empty schema accepts anything
  }
}

export class DhiNaN extends DhiType<number, number> {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<number> {
    if (typeof value !== 'number' || !Number.isNaN(value)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected NaN' }]) };
    }
    return { success: true, data: value };
  }
}

// ============================================================================
// Literal & Enum
// ============================================================================

export class DhiLiteral<T extends string | number | boolean | bigint | null | undefined> extends DhiType<T, T> {
  private _values: T[];

  constructor(value: T | readonly T[]) {
    super();
    if (Array.isArray(value)) {
      this._values = (value as readonly T[]).slice() as T[];
    } else {
      this._values = [value as T];
    }
  }

  get value(): T { return this._values[0]; }

  _parse(input: unknown, path: (string | number)[]): SafeParseResult<T> {
    if (!this._values.includes(input as T)) {
      const expected = this._values.length === 1
        ? JSON.stringify(this._values[0])
        : this._values.map(v => JSON.stringify(v)).join(' | ');
      return { success: false, error: new ZodError([{ code: 'invalid_literal', path, message: `Expected ${expected}, received ${JSON.stringify(input)}` }]) };
    }
    return { success: true, data: input as T };
  }

  _fastValid(value: unknown): boolean { return this._values.includes(value as T); }

  protected _toJsonSchemaCore(): Record<string, any> {
    if (this._values.length === 1) {
      return { const: this._values[0] };
    }
    return { enum: this._values };
  }
}

export class DhiEnum<T extends readonly [string, ...string[]]> extends DhiType<T[number], T[number]> {
  readonly options: T;
  readonly enum: { [K in T[number]]: K };
  private _set: Set<string>;

  constructor(values: T) {
    super();
    this.options = values;
    this._set = new Set(values);
    this.enum = {} as any;
    for (const val of values) {
      (this.enum as any)[val] = val;
    }
  }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T[number]> {
    if (typeof value !== 'string' || !this._set.has(value)) {
      return { success: false, error: new ZodError([{ code: 'invalid_enum_value', path, message: `Invalid enum value. Expected ${this.options.map(v => `'${v}'`).join(' | ')}, received '${value}'` }]) };
    }
    return { success: true, data: value as T[number] };
  }

  _fastValid(value: unknown): boolean { return typeof value === 'string' && this._set.has(value); }

  extract<U extends T[number]>(values: readonly U[]): DhiEnum<[U, ...U[]]> {
    return new DhiEnum(values as any);
  }

  exclude<U extends T[number]>(values: readonly U[]): DhiEnum<[Exclude<T[number], U>]> {
    const remaining = this.options.filter(v => !values.includes(v as any));
    return new DhiEnum(remaining as any);
  }

  protected _toJsonSchemaCore(): Record<string, any> {
    return { type: 'string', enum: [...this.options] };
  }
}

export class DhiNativeEnum<T extends Record<string, string | number>> extends DhiType<T[keyof T], T[keyof T]> {
  private _values: Set<string | number>;

  constructor(private enumObj: T) {
    super();
    this._values = new Set(Object.values(enumObj));
  }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T[keyof T]> {
    if (!this._values.has(value as any)) {
      return { success: false, error: new ZodError([{ code: 'invalid_enum_value', path, message: 'Invalid enum value' }]) };
    }
    return { success: true, data: value as T[keyof T] };
  }

  protected _toJsonSchemaCore(): Record<string, any> {
    return { enum: [...this._values] };
  }
}

// ============================================================================
// JIT compilation helpers (shared by DhiObject, DhiArray, and friends)
// ============================================================================

// True if `schema` can legitimately produce null as output. Such schemas
// can't participate in JIT contexts that use null as the failure sentinel
// (union members, array element validators).
function jitCanOutputNull(schema: DhiType<any, any>): boolean {
    if (schema instanceof DhiNullable || schema instanceof DhiNull ||
        schema instanceof DhiAny || schema instanceof DhiUnknown ||
        schema instanceof DhiDefault || schema instanceof DhiOptional ||
        schema instanceof DhiCatch || schema instanceof DhiTransform) {
      return true;
    }
    if (schema instanceof DhiLiteral) return (schema as any).value === null;
    if (schema instanceof DhiUnion) {
      return ((schema as any).options as DhiType<any, any>[]).some(o => jitCanOutputNull(o));
    }
    if (schema instanceof DhiRefine || schema instanceof DhiSuperRefine || schema instanceof DhiCheck ||
        schema instanceof DhiNonOptional || schema instanceof DhiExactOptional) {
      return jitCanOutputNull((schema as any)._inner);
    }
    if (schema instanceof DhiPipe) return jitCanOutputNull((schema as any)._b);
    if (schema instanceof DhiIntersection) {
      return jitCanOutputNull((schema as any).left) || jitCanOutputNull((schema as any).right);
    }
    if (schema instanceof DhiLazy) {
      // The getter may not be callable yet (TDZ during recursive schema
      // definition) and may recurse; guard both.
      if (_jitLazyVisiting.has(schema)) return false; // cycle: assume inner decides
      _jitLazyVisiting.add(schema);
      try {
        return jitCanOutputNull((schema as any).getter());
      } catch {
        return true; // can't resolve yet: be conservative
      } finally {
        _jitLazyVisiting.delete(schema);
      }
    }
    return false;
}
const _jitLazyVisiting = new WeakSet<object>();

// True if `schema` can produce undefined as output (optional keys, `.catch()`,
// transforms, ...). Object JIT code emits such keys conditionally so absent
// optional keys stay absent, like Zod; other keys use the object-literal path.
function jitCanOutputUndefined(schema: DhiType<any, any>): boolean {
    if (schema instanceof DhiOptional || schema instanceof DhiUndefined || schema instanceof DhiVoid ||
        schema instanceof DhiAny || schema instanceof DhiUnknown || schema instanceof DhiCatch ||
        schema instanceof DhiTransform || schema instanceof DhiCustom || schema instanceof DhiSuccess ||
        schema instanceof DhiPreprocess) {
      return true;
    }
    if (schema instanceof DhiLiteral) return (schema as any)._values.includes(undefined);
    if (schema instanceof DhiDefault) {
      const dflt = (schema as any)._default;
      return typeof dflt === 'function' || dflt === undefined || jitCanOutputUndefined((schema as any)._inner);
    }
    if (schema instanceof DhiExactOptional) return true;
    if (schema instanceof DhiNullable || schema instanceof DhiRefine || schema instanceof DhiSuperRefine ||
        schema instanceof DhiCheck || schema instanceof DhiReadonly) {
      return jitCanOutputUndefined((schema as any)._inner);
    }
    if (schema instanceof DhiPipe) return jitCanOutputUndefined((schema as any)._b);
    if (schema instanceof DhiUnion) {
      return ((schema as any).options as DhiType<any, any>[]).some(o => jitCanOutputUndefined(o));
    }
    if (schema instanceof DhiIntersection) {
      return jitCanOutputUndefined((schema as any).left) || jitCanOutputUndefined((schema as any).right);
    }
    if (schema instanceof DhiLazy) {
      if (_jitLazyVisiting.has(schema)) return false;
      _jitLazyVisiting.add(schema);
      try {
        return jitCanOutputUndefined((schema as any).getter());
      } catch {
        return true;
      } finally {
        _jitLazyVisiting.delete(schema);
      }
    }
    return false;
}

// Generic top-level JIT fast path for wrapper/composite schemas (refine,
// pipe, union, set, map, ...). Compiles a standalone validator on first use;
// returns a success result, or undefined to fall through to the interpreted
// path (errors, or schema not JIT-able). Skipped when the schema can output
// null (null is the JIT failure sentinel).
function jitTryFast(self: any, value: unknown): SafeParseResult<any> | undefined {
  let jf = self._jitTop;
  if (jf === undefined) {
    jf = self._jitTop = jitCanOutputNull(self) ? null : jitCompileValueFn(self);
  }
  if (jf !== null) {
    const r = jf(value);
    if (r !== null) return { success: true, data: r };
  }
  return undefined;
}

// z.coerce.* schemas subclass the primitive schemas; fast paths keyed on
// instanceof the parent class must exclude them (they need coercion first).
function jitIsCoerced(s: any): boolean {
  return s instanceof DhiCoercedString || s instanceof DhiCoercedNumber ||
    s instanceof DhiCoercedBoolean || s instanceof DhiCoercedDate ||
    s instanceof DhiCoercedBigInt;
}

// Compile a standalone validator for a single value: returns the
// (possibly transformed) value, or null on failure. Used for JITting
// array elements and union members.
function jitCompileValueFn(schema: DhiType<any, any>): ((v: any) => any) | null {
    if (schema instanceof DhiObject) {
      if ((schema as any)._jit === undefined) {
        (schema as any)._jit = (schema as any)._compileJIT();
      }
      return (schema as any)._jit;
    }
    const vars: any[] = [];
    const names: string[] = [];
    const check = jitEmitFieldCheck('v', schema, vars, names, 0);
    if (!check) return null;
    try {
      const fn = new Function(...names, `return function(v){${check}return v;};`);
      return fn(...vars);
    } catch {
      return null;
    }
}

function jitEmitFieldCheck(vi: string, schema: DhiType<any, any>, vars: any[], names: string[], idx: number): string | null {
    // Bind a runtime value (validator fn, regex, ...) to a unique closure name
    const bind = (prefix: string, value: any): string => {
      const name = `${prefix}${names.length}_${idx}`;
      names.push(name);
      vars.push(value);
      return name;
    };
    // Unwrap optional/nullable
    if (schema instanceof DhiOptional) {
      const inner = (schema as any)._inner;
      const innerCheck = jitEmitFieldCheck(vi, inner, vars, names, idx);
      if (!innerCheck) return null;
      return `if(${vi}!==undefined){${innerCheck}}`;
    }
    if (schema instanceof DhiNullable) {
      const inner = (schema as any)._inner;
      const innerCheck = jitEmitFieldCheck(vi, inner, vars, names, idx);
      if (!innerCheck) return null;
      return `if(${vi}!==null){${innerCheck}}`;
    }

    // Coercion (z.coerce.*): these subclass the primitive schemas, so they
    // must be detected BEFORE the instanceof checks below. Emit the coercion
    // first, then fall through to the normal primitive checks. (Previously
    // they matched the parent branch and were validated WITHOUT coercion.)
    let coerce = '';
    if (schema instanceof DhiCoercedBigInt) {
      return null; // BigInt() throws on bad input; interpreted path handles it
    } else if (schema instanceof DhiCoercedString) {
      coerce = `${vi}=String(${vi});`;
    } else if (schema instanceof DhiCoercedNumber) {
      coerce = `${vi}=Number(${vi});`;
    } else if (schema instanceof DhiCoercedBoolean) {
      coerce = `${vi}=Boolean(${vi});`;
    } else if (schema instanceof DhiCoercedDate) {
      coerce = `if(!(${vi} instanceof Date)){try{${vi}=new Date(${vi});}catch(e){return null;}}`;
    }

    if (schema instanceof DhiString) {
      const checks = (schema as any).checks;
      let code = coerce + `if(typeof ${vi}!=="string")return null;`;
      for (const check of checks) {
        switch (check.type) {
          case 'min': code += `if(${vi}.length<${check.value})return null;`; break;
          case 'max': code += `if(${vi}.length>${check.value})return null;`; break;
          case 'length': code += `if(${vi}.length!==${check.value})return null;`; break;
          case 'nonempty': code += `if(${vi}.length===0)return null;`; break;
          case 'email': code += `if(!${bind('_e', fastValidateEmail)}(${vi}))return null;`; break;
          case 'uuid': code += `if(!${bind('_u', fastValidateUuid)}(${vi},${check.value === undefined ? 'undefined' : check.value}))return null;`; break;
          case 'guid': code += `if(!${bind('_g', fastValidateGuid)}(${vi}))return null;`; break;
          case 'url': {
            const opts = check.value;
            const fname = bind('_url', (s: string) => validateUrl(s, opts));
            code += `${vi}=${fname}(${vi});if(${vi}===null)return null;`;
            break;
          }
          case 'base64': code += `if(!${bind('_b', fastValidateBase64)}(${vi}))return null;`; break;
          case 'date': code += `if(!${bind('_d', fastValidateDate)}(${vi}))return null;`; break;
          case 'ipv4': code += `if(!${bind('_ip4', fastValidateIpv4)}(${vi}))return null;`; break;
          case 'ipv6': code += `if(!${bind('_ip6', fastValidateIpv6)}(${vi}))return null;`; break;
          case 'ip': code += `if(!${bind('_ip', (s: string) => fastValidateIpv4(s) || fastValidateIpv6(s))}(${vi}))return null;`; break;
          case 'cidrv6': code += `if(!${bind('_c6', fastValidateCidrv6)}(${vi}))return null;`; break;
          case 'base64url': code += `if(!${bind('_bu', fastValidateBase64Url)}(${vi}))return null;`; break;
          case 'jwt': {
            const alg = check.value;
            code += `if(!${bind('_jwt', (s: string) => isValidJWT(s, alg))}(${vi}))return null;`;
            break;
          }
          case 'includes': code += `if(!${vi}.includes(${JSON.stringify(check.value)}${check.position !== undefined ? ',' + check.position : ''}))return null;`; break;
          case 'startsWith': code += `if(!${vi}.startsWith(${JSON.stringify(check.value)}))return null;`; break;
          case 'endsWith': code += `if(!${vi}.endsWith(${JSON.stringify(check.value)}))return null;`; break;
          case 'trim': code += `${vi}=${vi}.trim();`; break;
          case 'toLowerCase': code += `${vi}=${vi}.toLowerCase();`; break;
          case 'toUpperCase': code += `${vi}=${vi}.toUpperCase();`; break;
          case 'normalize': code += `${vi}=${vi}.normalize(${JSON.stringify(check.value || 'NFC')});`; break;
          case 'slugify': code += `${vi}=${vi}.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");`; break;
          case 'regex': {
            const fname = bind('_rx', check.value);
            code += `${fname}.lastIndex=0;if(!${fname}.test(${vi}))return null;`;
            break;
          }
          // Per-check regexes (datetime/time/mac/hash are built from their options)
          case 'datetime': case 'time': case 'mac': case 'hash':
            code += `if(!${bind('_fx', check.value)}.test(${vi}))return null;`;
            break;
          // Shared regex-backed formats (same regexes as Zod 4)
          case 'cuid': case 'cuid2': case 'ulid': case 'xid': case 'ksuid': case 'nanoid': case 'duration':
          case 'emoji': case 'cidrv4': case 'e164': case 'hostname': case 'hex': case 'lowercase': case 'uppercase':
            code += `if(!${bind('_fx', FORMAT_REGEXES[check.type])}.test(${vi}))return null;`;
            break;
          default: return null; // Can't JIT this check
        }
      }
      return code;
    }

    if (schema instanceof DhiNumber) {
      const checks = (schema as any).checks;
      // `v - v !== 0` rejects NaN and ±Infinity in one branch (Zod 4 semantics)
      let code = coerce + `if(typeof ${vi}!=="number"||${vi}-${vi}!==0)return null;`;
      for (const check of checks) {
        switch (check.type) {
          case 'min': code += `if(${vi}<${check.value})return null;`; break;
          case 'max': code += `if(${vi}>${check.value})return null;`; break;
          case 'gt': code += `if(${vi}<=${check.value})return null;`; break;
          case 'gte': code += `if(${vi}<${check.value})return null;`; break;
          case 'lt': code += `if(${vi}>=${check.value})return null;`; break;
          case 'lte': code += `if(${vi}>${check.value})return null;`; break;
          case 'int': code += `if(!Number.isSafeInteger(${vi}))return null;`; break;
          case 'positive': code += `if(${vi}<=0)return null;`; break;
          case 'negative': code += `if(${vi}>=0)return null;`; break;
          case 'nonnegative': code += `if(${vi}<0)return null;`; break;
          case 'nonpositive': code += `if(${vi}>0)return null;`; break;
          case 'finite': break; // non-finite values already rejected by the type check
          case 'multipleOf': case 'step': code += `if(!${bind('_mo', isMultipleOf)}(${vi},${check.value}))return null;`; break;
          case 'safe': code += `if(${vi}<-9007199254740991||${vi}>9007199254740991)return null;`; break;
          default: return null;
        }
      }
      return code;
    }

    if (schema instanceof DhiBoolean) {
      return coerce + `if(typeof ${vi}!=="boolean")return null;`;
    }

    if (schema instanceof DhiEnum) {
      const fname = `_en${idx}`;
      names.push(fname);
      vars.push((schema as any)._set);
      return `if(!${fname}.has(${vi}))return null;`;
    }

    if (schema instanceof DhiLiteral) {
      const litVal = (schema as any).value;
      return `if(${vi}!==${JSON.stringify(litVal)})return null;`;
    }

    if (schema instanceof DhiObject) {
      // Recursively JIT nested objects
      const fname = `_obj${names.length}_${idx}`;
      // Ensure nested object has its JIT compiled
      if ((schema as any)._jit === undefined) {
        (schema as any)._jit = (schema as any)._compileJIT();
      }
      const nestedJit = (schema as any)._jit;
      if (nestedJit) {
        names.push(fname);
        vars.push(nestedJit);
        return `${vi}=${fname}(${vi});if(${vi}===null)return null;`;
      }
      return null; // Can't JIT nested object
    }

    if (schema instanceof DhiDate) {
      const checks = (schema as any).checks;
      let code = coerce + `if(!(${vi} instanceof Date)||${vi}.getTime()!==${vi}.getTime())return null;`;
      for (const check of checks) {
        switch (check.type) {
          case 'min': code += `if(${vi}.getTime()<${(check.value as Date).getTime()})return null;`; break;
          case 'max': code += `if(${vi}.getTime()>${(check.value as Date).getTime()})return null;`; break;
          default: return null;
        }
      }
      return code;
    }

    if (schema instanceof DhiAny || schema instanceof DhiUnknown) {
      return ';'; // no check needed
    }

    if (schema instanceof DhiNull) {
      return `if(${vi}!==null)return null;`;
    }

    if (schema instanceof DhiUndefined) {
      return `if(${vi}!==undefined)return null;`;
    }

    if (schema instanceof DhiDefault) {
      const inner = (schema as any)._inner;
      const dflt = (schema as any)._default;
      const innerCheck = jitEmitFieldCheck(vi, inner, vars, names, idx);
      if (!innerCheck) return null;
      const fname = `_df${names.length}_${idx}`;
      names.push(fname);
      vars.push(typeof dflt === 'function' ? dflt : () => dflt);
      return `if(${vi}===undefined){${vi}=${fname}();}else{${innerCheck}}`;
    }

    if (schema instanceof DhiUnion) {
      // JIT unions whose members can't output null (null = failure sentinel)
      const options = (schema as any).options as DhiType<any, any>[];
      const fns: Array<(v: any) => any> = [];
      for (const opt of options) {
        if (jitCanOutputNull(opt)) return null;
        const fn = jitCompileValueFn(opt);
        if (!fn) return null;
        fns.push(fn);
      }
      const fname = `_un${names.length}_${idx}`;
      names.push(fname);
      vars.push(function unionCheck(v: any) {
        for (let i = 0; i < fns.length; i++) {
          const r = fns[i](v);
          if (r !== null) return r;
        }
        return null;
      });
      return `${vi}=${fname}(${vi});if(${vi}===null)return null;`;
    }

    if (schema instanceof DhiArray) {
      const elem = (schema as any).element;
      const lenChecks = (schema as any).checks;

      let code = `if(!Array.isArray(${vi}))return null;`;
      for (const check of lenChecks) {
        switch (check.type) {
          case 'min': code += `if(${vi}.length<${check.value})return null;`; break;
          case 'max': code += `if(${vi}.length>${check.value})return null;`; break;
          case 'length': code += `if(${vi}.length!==${check.value})return null;`; break;
          case 'nonempty': code += `if(${vi}.length===0)return null;`; break;
          default: return null;
        }
      }

      const iv = `_i${names.length}_${idx}`;
      // Zero-copy fast loops for check-free primitive elements (matches the
      // generic path: valid arrays are returned by reference, untouched).
      // Coerced subclasses must NOT take these loops (they transform values).
      if (elem instanceof DhiNumber && (elem as any).checks.length === 0 && !jitIsCoerced(elem)) {
        return code + `for(var ${iv}=0;${iv}<${vi}.length;${iv}++){var ${iv}x=${vi}[${iv}];if(typeof ${iv}x!=="number"||${iv}x-${iv}x!==0)return null;}`;
      }
      if (elem instanceof DhiString && (elem as any).checks.length === 0 && !jitIsCoerced(elem)) {
        return code + `for(var ${iv}=0;${iv}<${vi}.length;${iv}++){if(typeof ${vi}[${iv}]!=="string")return null;}`;
      }
      if (elem instanceof DhiBoolean && !jitIsCoerced(elem)) {
        return code + `for(var ${iv}=0;${iv}<${vi}.length;${iv}++){if(typeof ${vi}[${iv}]!=="boolean")return null;}`;
      }

      // General path: any JIT-able element (nested objects, enums, literals,
      // checked primitives, unions, ...). Copy-on-transform keeps reference
      // semantics identical to the interpreted path.
      if (jitCanOutputNull(elem)) return null;
      const elemFn = jitCompileValueFn(elem);
      if (!elemFn) return null;
      const fname = `_el${names.length}_${idx}`;
      const ev = `_e${names.length}_${idx}`;
      const cv = `_c${names.length}_${idx}`;
      names.push(fname);
      vars.push(elemFn);
      return code +
        `var ${cv}=false;` +
        `for(var ${iv}=0;${iv}<${vi}.length;${iv}++){` +
        `var ${ev}=${fname}(${vi}[${iv}]);` +
        `if(${ev}===null)return null;` +
        `if(${ev}!==${vi}[${iv}]){if(!${cv}){${vi}=${vi}.slice();${cv}=true;}${vi}[${iv}]=${ev};}` +
        `}`;
    }

  if (schema instanceof DhiTuple) {
    const items = (schema as any).items as DhiType<any, any>[];
    const rest = (schema as any)._rest as DhiType<any, any> | undefined;
    const itemFns: Array<(v: any) => any> = [];
    for (const item of items) {
      if (jitCanOutputNull(item)) return null;
      const fn = jitCompileValueFn(item);
      if (!fn) return null;
      itemFns.push(fn);
    }
    let restFn: ((v: any) => any) | null = null;
    if (rest) {
      if (jitCanOutputNull(rest)) return null;
      restFn = jitCompileValueFn(rest);
      if (!restFn) return null;
    }
    const n = items.length;
    const optStart = (schema as DhiTuple<any>)._optStart();
    const fname = `_tp${names.length}_${idx}`;
    names.push(fname);
    vars.push(function tupleCheck(v: any) {
      if (!Array.isArray(v)) return null;
      if (!restFn && v.length > n) return null;
      if (v.length < optStart) return null;
      const out = new Array(v.length);
      const present = v.length < n ? v.length : n;
      for (let i = 0; i < present; i++) {
        const r = itemFns[i](v[i]);
        if (r === null) return null;
        out[i] = r;
      }
      for (let i = n; i < v.length; i++) {
        const r = restFn!(v[i]);
        if (r === null) return null;
        out[i] = r;
      }
      return out;
    });
    return `${vi}=${fname}(${vi});if(${vi}===null)return null;`;
  }

  if (schema instanceof DhiRecord) {
    const keyS = (schema as any).keySchema;
    const valS = (schema as any).valueSchema;
    if (jitCanOutputNull(valS)) return null;
    const valFn = jitCompileValueFn(valS);
    if (!valFn) return null;
    // Keys must be string schemas; transforms (trim etc.) are applied to keys
    let keyFn: ((v: any) => any) | null = null;
    if (keyS instanceof DhiString) {
      if ((keyS as any).checks.length > 0) {
        keyFn = jitCompileValueFn(keyS);
        if (!keyFn) return null;
      }
    } else if (keyS instanceof DhiEnum) {
      // Exhaustive enum-keyed records have Zod-specific semantics; leave them to the interpreter
      if (!(schema as any)._partial) return null;
      keyFn = jitCompileValueFn(keyS);
      if (!keyFn) return null;
    } else {
      return null;
    }
    const fname = `_rc${names.length}_${idx}`;
    names.push(fname);
    vars.push(function recordCheck(v: any) {
      if (!isPlainObject(v)) return null;
      const out: Record<string, any> = {};
      const ks = Object.keys(v);
      for (let i = 0; i < ks.length; i++) {
        let k = ks[i];
        if (keyFn) {
          k = keyFn(k);
          if (k === null) return null;
        }
        const r = valFn(v[ks[i]]);
        if (r === null) return null;
        out[k] = r;
      }
      return out;
    });
    return `${vi}=${fname}(${vi});if(${vi}===null)return null;`;
  }

  if (schema instanceof DhiTransform) {
    // Inner check + transform call. Failure inside the transform maps to a
    // unique sentinel (the output may legitimately be any value, incl. null).
    const innerCheck = jitEmitFieldCheck(vi, (schema as any)._inner, vars, names, idx);
    if (!innerCheck) return null;
    const tf = (schema as any)._transform as (v: any) => any;
    const FAIL = {};
    const fname = `_tf${names.length}_${idx}`;
    const sname = `_tS${names.length}_${idx}`;
    names.push(fname, sname);
    vars.push((v: any) => { try { return tf(v); } catch { return FAIL; } }, FAIL);
    return `${innerCheck}${vi}=${fname}(${vi});if(${vi}===${sname})return null;`;
  }

  if (schema instanceof DhiRefine) {
    const innerCheck = jitEmitFieldCheck(vi, (schema as any)._inner, vars, names, idx);
    if (!innerCheck) return null;
    const fname = `_rf${names.length}_${idx}`;
    names.push(fname);
    vars.push((schema as any)._check);
    return `${innerCheck}if(!${fname}(${vi}))return null;`;
  }

  if (schema instanceof DhiSuperRefine) {
    const innerCheck = jitEmitFieldCheck(vi, (schema as any)._inner, vars, names, idx);
    if (!innerCheck) return null;
    const refinement = (schema as any)._refinement;
    const fname = `_sr${names.length}_${idx}`;
    names.push(fname);
    vars.push((v: any) => {
      let ok = true;
      refinement(v, { addIssue: () => { ok = false; } });
      return ok;
    });
    return `${innerCheck}if(!${fname}(${vi}))return null;`;
  }

  if (schema instanceof DhiPipe) {
    const ca = jitEmitFieldCheck(vi, (schema as any)._a, vars, names, idx);
    if (!ca) return null;
    const cb = jitEmitFieldCheck(vi, (schema as any)._b, vars, names, idx);
    if (!cb) return null;
    return ca + cb;
  }

  if (schema instanceof DhiSet) {
    const valS = (schema as any).valueSchema;
    const sizeChecks = [...(schema as any).checks];
    if (jitCanOutputNull(valS)) return null;
    const elemFn = jitCompileValueFn(valS);
    if (!elemFn) return null;
    const fname = `_st${names.length}_${idx}`;
    names.push(fname);
    vars.push(function setCheck(v: any) {
      if (!(v instanceof Set)) return null;
      for (const c of sizeChecks) {
        if (c.type === 'min' && v.size < c.value) return null;
        if (c.type === 'max' && v.size > c.value) return null;
        if (c.type === 'size' && v.size !== c.value) return null;
        if (c.type === 'nonempty' && v.size === 0) return null;
      }
      const out = new Set();
      for (const item of v) {
        const r = elemFn(item);
        if (r === null) return null;
        out.add(r);
      }
      return out;
    });
    return `${vi}=${fname}(${vi});if(${vi}===null)return null;`;
  }

  if (schema instanceof DhiMap) {
    const keyS = (schema as any).keySchema;
    const valS = (schema as any).valueSchema;
    if (jitCanOutputNull(keyS) || jitCanOutputNull(valS)) return null;
    const keyFn = jitCompileValueFn(keyS);
    const valFn = jitCompileValueFn(valS);
    if (!keyFn || !valFn) return null;
    const fname = `_mp${names.length}_${idx}`;
    names.push(fname);
    vars.push(function mapCheck(v: any) {
      if (!(v instanceof Map)) return null;
      const out = new Map();
      for (const [k, val] of v.entries()) {
        const kr = keyFn(k);
        if (kr === null) return null;
        const vr = valFn(val);
        if (vr === null) return null;
        out.set(kr, vr);
      }
      return out;
    });
    return `${vi}=${fname}(${vi});if(${vi}===null)return null;`;
  }

  if (schema instanceof DhiLazy) {
    // Defer resolving + compiling the inner schema until first parse: the
    // getter is typically not callable at compile time (TDZ during recursive
    // schema definition, e.g. const Node = z.object({kids: z.array(z.lazy(() => Node))})).
    const getter = (schema as any).getter as () => DhiType<any, any>;
    const FAIL = {};
    let inner: ((v: any) => any) | null | undefined = undefined;
    let interpreted: DhiType<any, any> | undefined;
    const fname = `_lz${names.length}_${idx}`;
    const sname = `_lS${names.length}_${idx}`;
    names.push(fname, sname);
    vars.push(function lazyCheck(v: any) {
      if (inner === undefined) {
        const resolved = getter();
        inner = jitCanOutputNull(resolved) ? null : jitCompileValueFn(resolved);
        if (inner === null) interpreted = resolved;
      }
      if (inner !== null) {
        const r = inner(v);
        return r === null ? FAIL : r; // compiled inner never outputs null
      }
      // Inner not JIT-able: interpreted fallback (handles legit null output)
      const res = interpreted!._parse(v, EMPTY_PATH);
      return res.success ? res.data : FAIL;
    }, FAIL);
    return `${vi}=${fname}(${vi});if(${vi}===${sname})return null;`;
  }

  if (schema instanceof DhiIntersection) {
    const left = (schema as any).left;
    const right = (schema as any).right;
    if (jitCanOutputNull(left) || jitCanOutputNull(right)) return null;
    const leftFn = jitCompileValueFn(left);
    const rightFn = jitCompileValueFn(right);
    if (!leftFn || !rightFn) return null;
    const fname = `_ix${names.length}_${idx}`;
    names.push(fname);
    vars.push(function intersectionCheck(v: any) {
      const l = leftFn(v);
      if (l === null) return null;
      const r = rightFn(v);
      if (r === null) return null;
      // Merge semantics identical to the interpreted path
      if (typeof l === 'object' && typeof r === 'object') return { ...l, ...r };
      return l;
    });
    return `${vi}=${fname}(${vi});if(${vi}===null)return null;`;
  }

  if (schema instanceof DhiDiscriminatedUnion) {
    const optionsMap = (schema as any)._optionsMap as Map<any, any>;
    const discriminator = (schema as any).discriminator as string;
    const jitMap = new Map<any, (v: any) => any>();
    for (const [lit, option] of optionsMap) {
      if ((option as any)._jit === undefined) {
        (option as any)._jit = (option as any)._compileJIT();
      }
      const optJit = (option as any)._jit;
      if (!optJit) return null;
      jitMap.set(lit, optJit);
    }
    const fname = `_du${names.length}_${idx}`;
    names.push(fname);
    vars.push(function discUnionCheck(v: any) {
      if (typeof v !== 'object' || v === null) return null;
      const fn = jitMap.get(v[discriminator]);
      if (!fn) return null;
      return fn(v);
    });
    return `${vi}=${fname}(${vi});if(${vi}===null)return null;`;
  }

  return null; // Unknown schema type, can't JIT
}

// ============================================================================
// Object Schema
// ============================================================================

export class DhiObject<T extends Record<string, DhiType<any, any>>> extends DhiType<ObjectOutput<T>, ObjectInput<T>> {
  readonly shape: T;
  private _keys: string[];
  private _unknownKeys: 'strip' | 'strict' | 'passthrough' = 'strip';
  private _catchall?: DhiType<any, any>;
  private _jit: ((value: any) => any) | null | undefined = undefined; // undefined = not compiled yet
  private _absentOkCache: boolean[] | undefined = undefined;

  constructor(shape: T) {
    super();
    this.shape = shape;
    this._keys = Object.keys(shape);
  }

  /** Per key: may the key be absent even though its schema rejects `undefined`? (Zod's optout rule, e.g. exactOptional) */
  private _absentOk(): boolean[] {
    return this._absentOkCache ??= this._keys.map(k => zodOptionality(this.shape[k], 'out') === 'optional');
  }

  private _compileJIT(): ((value: any) => any) | null {
    if (this._catchall) return null;

    const mode = this._unknownKeys;
    const keys = this._keys;
    const shape = this.shape;
    const closureVars: any[] = [];
    const closureNames: string[] = [];
    const bodyLines: string[] = [];

    bodyLines.push('return function(v){');
    bodyLines.push('if(typeof v!=="object"||v===null||Array.isArray(v))return null;');

    if (mode === 'strict') {
      // Reject unknown keys up front (error details produced by slow path)
      closureNames.push('_known');
      closureVars.push(new Set(keys));
      bodyLines.push('var _ks=Object.keys(v);for(var _q=0;_q<_ks.length;_q++){if(!_known.has(_ks[_q]))return null;}');
    }

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const ks = JSON.stringify(key);
      const vi = `v${i}`;
      bodyLines.push(`var ${vi}=v[${ks}];`);

      const schema = shape[key];
      if (schema instanceof DhiExactOptional) {
        // Zod exactOptional: validate only when the key is present (absent keys are skipped)
        const inner = jitEmitFieldCheck(vi, (schema as any)._inner, closureVars, closureNames, i);
        if (!inner) return null;
        bodyLines.push(`if(${ks} in v){${inner}}`);
      } else {
        const emitted = jitEmitFieldCheck(vi, schema, closureVars, closureNames, i);
        if (!emitted) return null; // Can't JIT this schema, fallback
        bodyLines.push(emitted);
      }
    }

    // Build result object. Like Zod, a key whose parsed value is undefined is
    // only emitted when it was present in the input (`"k" in v`), so absent
    // optional keys stay absent. Shapes whose fields can never yield undefined
    // keep the straight object-literal fast path.
    const maybeUndef = keys.map(k => jitCanOutputUndefined(shape[k]));
    if (mode === 'passthrough') {
      // Copy unknown keys first, then overwrite with validated/transformed values
      bodyLines.push('var _r={};var _ks=Object.keys(v);for(var _q=0;_q<_ks.length;_q++){_r[_ks[_q]]=v[_ks[_q]];}');
      for (let i = 0; i < keys.length; i++) {
        const ks = JSON.stringify(keys[i]);
        bodyLines.push(maybeUndef[i] ? `if(v${i}!==undefined||${ks} in v)_r[${ks}]=v${i};` : `_r[${ks}]=v${i};`);
      }
      bodyLines.push('return _r;};');
    } else if (maybeUndef.some(Boolean)) {
      bodyLines.push('var _r={};');
      for (let i = 0; i < keys.length; i++) {
        const ks = JSON.stringify(keys[i]);
        bodyLines.push(maybeUndef[i] ? `if(v${i}!==undefined||${ks} in v)_r[${ks}]=v${i};` : `_r[${ks}]=v${i};`);
      }
      bodyLines.push('return _r;};');
    } else {
      bodyLines.push('return{');
      for (let i = 0; i < keys.length; i++) {
        bodyLines.push(`${JSON.stringify(keys[i])}:v${i},`);
      }
      bodyLines.push('};};');
    }

    try {
      const fn = new Function(...closureNames, bodyLines.join('\n'));
      return fn(...closureVars);
    } catch {
      return null;
    }
  }


  _parse(value: unknown, path: (string | number)[]): SafeParseResult<any> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected object, received ' + (Array.isArray(value) ? 'array' : typeof value) }]) };
    }

    // Compile JIT on first use
    if (this._jit === undefined) {
      this._jit = this._compileJIT();
    }

    // Use JIT fast path if available
    if (this._jit) {
      const jitResult = this._jit(value);
      if (jitResult !== null) {
        return { success: true, data: jitResult };
      }
      // JIT returned null = validation failed, fall through to error path
    } else {
      // No JIT available, try generic fast path
      const obj = value as Record<string, unknown>;
      const keys = this._keys;
      const shape = this.shape;
      const numKeys = keys.length;
      const result: Record<string, any> = {};
      let hasError = false;

      for (let ki = 0; ki < numKeys; ki++) {
        const key = keys[ki];
        const fieldResult = shape[key]._parse(obj[key], EMPTY_PATH);
        if (!fieldResult.success) {
          // Zod: errors on an ABSENT key are ignored when the field is optional on the output side
          if (!(key in obj) && this._absentOk()[ki]) continue;
          hasError = true;
          break;
        }
        // Like Zod: an undefined value only keeps its key when the key was present in the input
        if (fieldResult.data !== undefined || key in obj) result[key] = fieldResult.data;
      }

      if (!hasError && this._unknownKeys === 'strip') {
        return { success: true, data: result };
      }
      if (!hasError) {
        // Handle strict/passthrough
        const issues: ZodIssue[] = [];
        if (this._unknownKeys === 'strict') {
          const obj2 = value as Record<string, unknown>;
          const objKeys = Object.keys(obj2);
          for (let i = 0; i < objKeys.length; i++) {
            if (!keys.includes(objKeys[i])) {
              issues.push({ code: 'unrecognized_keys', path, message: `Unrecognized key(s) in object: '${objKeys[i]}'` });
            }
          }
        } else if (this._unknownKeys === 'passthrough') {
          const obj2 = value as Record<string, unknown>;
          const objKeys = Object.keys(obj2);
          const catchall = this._catchall;
          for (let i = 0; i < objKeys.length; i++) {
            const key = objKeys[i];
            if (keys.includes(key)) continue;
            if (catchall) {
              // Unknown keys must satisfy the catchall schema (Zod semantics)
              const r = catchall._parse(obj2[key], [...path, key]);
              if (!r.success) issues.push(...r.error.issues);
              else result[key] = r.data;
            } else {
              result[key] = obj2[key];
            }
          }
        }
        if (issues.length > 0) return { success: false, error: new ZodError(issues) };
        return { success: true, data: result };
      }
    }

    // Slow error path: redo with proper paths for error reporting
    const obj = value as Record<string, unknown>;
    const keys = this._keys;
    const shape = this.shape;
    const issues: ZodIssue[] = [];
    const recovered: Record<string, any> = {};
    for (let ki = 0; ki < keys.length; ki++) {
      const key = keys[ki];
      const fieldResult = shape[key]._parse(obj[key], [...path, key]);
      if (!fieldResult.success) {
        if (!(key in obj) && this._absentOk()[ki]) continue;
        issues.push(...fieldResult.error.issues);
      } else if (fieldResult.data !== undefined || key in obj) {
        recovered[key] = fieldResult.data;
      }
    }
    if (this._unknownKeys === 'strict') {
      // The strict JIT rejects unknown keys without details; report them here
      const objKeys = Object.keys(obj);
      for (let i = 0; i < objKeys.length; i++) {
        if (!keys.includes(objKeys[i])) {
          issues.push({ code: 'unrecognized_keys', path, message: `Unrecognized key(s) in object: '${objKeys[i]}'` });
        }
      }
    }
    if (this._unknownKeys === 'passthrough') {
      const objKeys = Object.keys(obj);
      const catchall = this._catchall;
      for (let i = 0; i < objKeys.length; i++) {
        const key = objKeys[i];
        if (keys.includes(key)) continue;
        if (catchall) {
          const r = catchall._parse(obj[key], [...path, key]);
          if (!r.success) issues.push(...r.error.issues);
          else recovered[key] = r.data;
        } else {
          recovered[key] = obj[key];
        }
      }
    }
    if (issues.length === 0) {
      // Safety net: the JIT rejected but field-by-field validation passes
      // (semantic drift guard). Trust the interpreted result instead of
      // emitting an error with zero issues.
      return { success: true, data: recovered };
    }
    return { success: false, error: new ZodError(issues) };
  }

  /**
   * Fast-path overrides: dispatch straight to the compiled JIT validator,
   * skipping the generic _parse pre-checks. parse() additionally avoids
   * allocating the intermediate {success, data} result object entirely.
   */
  safeParse(value: unknown): SafeParseResult<ObjectOutput<T>> {
    if (this._jit === undefined) this._jit = this._compileJIT();
    if (this._jit !== null) {
      const r = this._jit(value);
      if (r !== null) return { success: true, data: r };
    }
    return this._parse(value, EMPTY_PATH);
  }

  parse(value: unknown): ObjectOutput<T> {
    if (this._jit === undefined) this._jit = this._compileJIT();
    if (this._jit !== null) {
      const r = this._jit(value);
      if (r !== null) return r;
    }
    const result = this._parse(value, EMPTY_PATH);
    if (!result.success) throw result.error;
    return result.data;
  }

  strict(message?: string): DhiObject<T> {
    const clone = this._clone();
    clone._unknownKeys = 'strict';
    return clone;
  }

  passthrough(): DhiObject<T> {
    const clone = this._clone();
    clone._unknownKeys = 'passthrough';
    return clone;
  }

  loose(): DhiObject<T> {
    return this.passthrough();
  }

  strip(): DhiObject<T> {
    const clone = this._clone();
    clone._unknownKeys = 'strip';
    return clone;
  }

  catchall<C extends DhiType<any, any>>(schema: C): DhiObject<T> {
    const clone = this._clone();
    clone._catchall = schema;
    clone._unknownKeys = 'passthrough';
    return clone;
  }

  extend<U extends Record<string, DhiType<any, any>>>(shape: U): DhiObject<T & U> {
    return new DhiObject({ ...this.shape, ...shape }) as any;
  }

  merge<U extends DhiObject<any>>(other: U): DhiObject<T & U["shape"]> {
    return new DhiObject({ ...this.shape, ...other.shape }) as any;
  }

  pick<K extends keyof T>(keys: { [P in K]: true }): DhiObject<Pick<T, K>> {
    const picked: any = {};
    for (const key of Object.keys(keys)) {
      if (key in this.shape) picked[key] = this.shape[key];
    }
    return new DhiObject(picked);
  }

  omit<K extends keyof T>(keys: { [P in K]: true }): DhiObject<Omit<T, K>> {
    const omitted: any = {};
    for (const key of this._keys) {
      if (!(key in keys)) omitted[key] = this.shape[key];
    }
    return new DhiObject(omitted);
  }

  partial(): DhiObject<{ [K in keyof T]: DhiOptional<T[K]> }> {
    const partialShape: any = {};
    for (const key of this._keys) {
      partialShape[key] = this.shape[key].optional();
    }
    return new DhiObject(partialShape);
  }

  deepPartial(): DhiObject<any> {
    const partialShape: any = {};
    for (const key of this._keys) {
      const field = this.shape[key];
      if (field instanceof DhiObject) {
        partialShape[key] = field.deepPartial().optional();
      } else {
        partialShape[key] = field.optional();
      }
    }
    return new DhiObject(partialShape);
  }

  required(): DhiObject<{ [K in keyof T]: T[K] extends DhiOptional<infer U> ? U : T[K] }> {
    const requiredShape: any = {};
    for (const key of this._keys) {
      const field = this.shape[key];
      requiredShape[key] = field instanceof DhiOptional ? (field as any)._inner : field;
    }
    return new DhiObject(requiredShape);
  }

  keyof(): DhiEnum<[string, ...string[]]> {
    return new DhiEnum(this._keys as [string, ...string[]]);
  }

  // Zod 4: valueof - get union of all value types
  valueof(): DhiUnion<[T[keyof T], ...T[keyof T][]]> {
    const schemas = Object.values(this.shape) as T[keyof T][];
    return new DhiUnion(schemas as any);
  }

  // Zod 4: entryof - get tuple of [key, value] union
  entryof(): DhiUnion<any> {
    const entries: DhiTuple<any>[] = [];
    for (const key of this._keys) {
      entries.push(new DhiTuple([new DhiLiteral(key), this.shape[key]]));
    }
    return new DhiUnion(entries as any);
  }

  private _clone(): DhiObject<T> {
    const clone = new DhiObject(this.shape);
    clone._unknownKeys = this._unknownKeys;
    clone._catchall = this._catchall;
    return clone;
  }

  protected _toJsonSchemaCore(): Record<string, any> {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    const dir = _jsonSchemaIo === 'input' ? 'in' : 'out';
    for (const key of this._keys) {
      const fieldSchema = this.shape[key];
      properties[key] = fieldSchema.toJsonSchema();
      // Zod 4 rule: a key is required unless the field is optional on this side (optin / optout)
      if (zodOptionality(fieldSchema, dir) === undefined) {
        required.push(key);
      }
    }

    const schema: Record<string, any> = {
      type: 'object',
      properties,
    };

    if (required.length > 0) {
      schema.required = required;
    }

    if (this._unknownKeys === 'strict') {
      schema.additionalProperties = false;
    } else if (this._catchall) {
      schema.additionalProperties = this._catchall.toJsonSchema();
    }

    return schema;
  }
}

// ============================================================================
// Array Schema
// ============================================================================

export class DhiArray<T extends DhiType<any, any>> extends DhiType<T["_output"][], T["_input"][]> {
  private checks: Array<{ type: string; value?: number; message?: string }> = [];
  private _jit: ((value: any) => any) | null | undefined = undefined;

  constructor(private element: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"][]> {
    // Top-level JIT fast path (compiled on first use); failures fall through
    // to the interpreted path below for proper error reporting.
    if (this._jit === undefined) this._jit = jitCompileValueFn(this);
    if (this._jit) {
      const r = this._jit(value);
      if (r !== null) return { success: true, data: r };
    }

    if (!Array.isArray(value)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected array, received ' + typeof value }]) };
    }

    const len = value.length;

    for (const check of this.checks) {
      if (check.type === 'min' && len < check.value!)
        return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `Array must contain at least ${check.value} element(s)` }]) };
      if (check.type === 'max' && len > check.value!)
        return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || `Array must contain at most ${check.value} element(s)` }]) };
      if (check.type === 'length' && len !== check.value!)
        return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `Array must contain exactly ${check.value} element(s)` }]) };
      if (check.type === 'nonempty' && len === 0)
        return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || 'Array must contain at least 1 element(s)' }]) };
    }

    // Fast path: for primitive type schemas, validate inline without allocations
    const elem = this.element;
    if (elem instanceof DhiNumber && (elem as any).checks.length === 0 && !jitIsCoerced(elem)) {
      for (let i = 0; i < len; i++) {
        const x = value[i];
        if (typeof x !== 'number' || x - x !== 0) {
          return { success: false, error: new ZodError([{ code: 'invalid_type', path: [...path, i], message: 'Expected number, received ' + (typeof x === 'number' ? (x !== x ? 'NaN' : 'Infinity') : typeof x) }]) };
        }
      }
      return { success: true, data: value as any };
    }
    if (elem instanceof DhiString && (elem as any).checks.length === 0 && !jitIsCoerced(elem)) {
      for (let i = 0; i < len; i++) {
        if (typeof value[i] !== 'string') {
          return { success: false, error: new ZodError([{ code: 'invalid_type', path: [...path, i], message: 'Expected string, received ' + typeof value[i] }]) };
        }
      }
      return { success: true, data: value as any };
    }
    if (elem instanceof DhiBoolean && !jitIsCoerced(elem)) {
      for (let i = 0; i < len; i++) {
        if (typeof value[i] !== 'boolean') {
          return { success: false, error: new ZodError([{ code: 'invalid_type', path: [...path, i], message: 'Expected boolean, received ' + typeof value[i] }]) };
        }
      }
      return { success: true, data: value as any };
    }

    // General path: full validation with path tracking.
    // Reuse one child-path array (avoid spreading per element). Allocate the
    // result array and issues array lazily: most elements don't transform and
    // most arrays are valid, so the common case returns the input untouched
    // (matching the primitive fast-paths above, which also return `value`).
    const childPath = path.concat(0 as any);
    const lastIdx = childPath.length - 1;
    let result: T["_output"][] | null = null;
    let issues: ZodIssue[] | null = null;

    for (let i = 0; i < len; i++) {
      childPath[lastIdx] = i;
      const r = elem._parse(value[i], childPath);
      if (!r.success) {
        if (!issues) issues = [];
        // Fresh path copy for the error (childPath is reused/mutated).
        for (const issue of r.error.issues) {
          issues.push({ ...issue, path: [...issue.path] });
        }
      } else if (r.data !== value[i]) {
        // A transform changed the element — materialize a result array now.
        if (!result) result = (value as any[]).slice();
        result[i] = r.data;
      }
    }

    if (issues) {
      return { success: false, error: new ZodError(issues) };
    }

    return { success: true, data: (result || value) as any };
  }

  min(length: number, message?: string): this { return this._withCheck({ type: 'min', value: length, message }); }
  max(length: number, message?: string): this { return this._withCheck({ type: 'max', value: length, message }); }
  length(length: number, message?: string): this { return this._withCheck({ type: 'length', value: length, message }); }
  nonempty(message?: string): this { return this._withCheck({ type: 'nonempty', message }); }

  // Zod 4 aliases
  minSize(length: number, message?: string): this { return this.min(length, message); }
  maxSize(length: number, message?: string): this { return this.max(length, message); }
  size(length: number, message?: string): this { return this.length(length, message); }

  protected _toJsonSchemaCore(): Record<string, any> {
    const schema: Record<string, any> = {
      type: 'array',
      items: this.element.toJsonSchema(),
    };
    for (const check of this.checks) {
      switch (check.type) {
        case 'min': case 'nonempty': schema.minItems = check.value ?? 1; break;
        case 'max': schema.maxItems = check.value; break;
        case 'length': schema.minItems = schema.maxItems = check.value; break;
      }
    }
    return schema;
  }
}

// ============================================================================
// Tuple Schema
// ============================================================================

type TupleOutput<T extends DhiType<any, any>[]> = { [K in keyof T]: T[K]["_output"] };
type TupleInput<T extends DhiType<any, any>[]> = { [K in keyof T]: T[K]["_input"] };

export class DhiTuple<T extends [DhiType<any, any>, ...DhiType<any, any>[]]> extends DhiType<TupleOutput<T>, TupleInput<T>> {
  private _rest?: DhiType<any, any>;
  private _jit: ((value: any) => any) | null | undefined = undefined;

  constructor(private items: T) { super(); }

  rest<R extends DhiType<any, any>>(schema: R): DhiTuple<T> {
    const clone = new DhiTuple(this.items);
    clone._rest = schema;
    return clone as any;
  }

  /** @internal Index of the first item that may be omitted (all items after it are optional) */
  _optStart(): number {
    const items = this.items as DhiType<any, any>[];
    let optStart = items.length;
    while (optStart > 0 && zodOptionality(items[optStart - 1], 'in') === 'optional') optStart--;
    return optStart;
  }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<TupleOutput<T>> {
    if (this._jit === undefined) this._jit = jitCompileValueFn(this);
    if (this._jit) {
      const r = this._jit(value);
      if (r !== null) return { success: true, data: r };
    }

    if (!Array.isArray(value)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected array (tuple)' }]) };
    }

    const n = this.items.length;
    if (!this._rest && value.length > n) {
      return { success: false, error: new ZodError([{ code: 'too_big', path, message: `Too big: expected array to have <=${n} items` }]) };
    }

    // Zod: trailing optional items may be omitted
    const optStart = this._optStart();
    if (value.length < optStart) {
      return { success: false, error: new ZodError([{ code: 'too_small', path, message: `Too small: expected array to have >=${optStart} items` }]) };
    }

    const result: any[] = [];
    const issues: ZodIssue[] = [];

    const present = Math.min(n, value.length);
    for (let i = 0; i < present; i++) {
      const r = this.items[i]._parse(value[i], [...path, i]);
      if (!r.success) issues.push(...r.error.issues);
      else result.push(r.data);
    }

    if (this._rest) {
      for (let i = this.items.length; i < value.length; i++) {
        const r = this._rest._parse(value[i], [...path, i]);
        if (!r.success) issues.push(...r.error.issues);
        else result.push(r.data);
      }
    }

    if (issues.length > 0) return { success: false, error: new ZodError(issues) };
    return { success: true, data: result as TupleOutput<T> };
  }
}

// ============================================================================
// Record Schema
// ============================================================================

export class DhiRecord<K extends DhiType<string, string>, V extends DhiType<any, any>> extends DhiType<Record<K["_output"], V["_output"]>, Record<K["_input"], V["_input"]>> {
  private _jit: ((value: any) => any) | null | undefined = undefined;
  /** @internal `z.partialRecord()`: enum/literal keys may be missing */
  _partial = false;

  constructor(private keySchema: K, private valueSchema: V) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<Record<K["_output"], V["_output"]>> {
    if (this._jit === undefined) this._jit = jitCompileValueFn(this);
    if (this._jit) {
      const r = this._jit(value);
      if (r !== null) return { success: true, data: r };
    }

    // Zod: records only accept plain objects (no arrays, Dates, class instances, ...)
    if (!isPlainObject(value)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected record, received ' + (Array.isArray(value) ? 'array' : typeof value) }]) };
    }

    const result: Record<string, any> = {};
    const issues: ZodIssue[] = [];
    const input = value as Record<string, unknown>;

    // Zod: a record keyed by an enum/literal is exhaustive — every key must validate
    // (missing keys are validated as `undefined`) and no other keys are allowed.
    const exhaustive = this._partial ? undefined : zodValues(this.keySchema);
    if (exhaustive) {
      for (const key of exhaustive) {
        if (typeof key !== 'string') continue;
        const valResult = this.valueSchema._parse(input[key], [...path, key]);
        if (!valResult.success) issues.push(...valResult.error.issues);
        else result[key] = valResult.data;
      }
      const unrecognized: string[] = [];
      for (const key in input) if (!exhaustive.has(key)) unrecognized.push(key);
      if (unrecognized.length > 0) {
        issues.push({ code: 'unrecognized_keys', path, message: `Unrecognized key(s) in object: ${unrecognized.map(k => `"${k}"`).join(', ')}` });
      }
      if (issues.length > 0) return { success: false, error: new ZodError(issues) };
      return { success: true, data: result };
    }

    for (const key of Object.keys(input)) {
      const keyResult = this.keySchema._parse(key, [...path, key]);
      if (!keyResult.success) {
        issues.push(...keyResult.error.issues);
        continue;
      }

      const valResult = this.valueSchema._parse(input[key], [...path, key]);
      if (!valResult.success) {
        issues.push(...valResult.error.issues);
      } else {
        result[keyResult.data] = valResult.data;
      }
    }

    if (issues.length > 0) return { success: false, error: new ZodError(issues) };
    return { success: true, data: result };
  }
}

// ============================================================================
// Map & Set
// ============================================================================

export class DhiMap<K extends DhiType<any, any>, V extends DhiType<any, any>> extends DhiType<Map<K["_output"], V["_output"]>, Map<K["_input"], V["_input"]>> {
  constructor(private keySchema: K, private valueSchema: V) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<Map<K["_output"], V["_output"]>> {
    const fast = jitTryFast(this, value);
    if (fast) return fast;
    if (!(value instanceof Map)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected Map' }]) };
    }

    const result = new Map<K["_output"], V["_output"]>();
    const issues: ZodIssue[] = [];

    for (const [k, v] of value.entries()) {
      const keyR = this.keySchema._parse(k, [...path, 'key']);
      const valR = this.valueSchema._parse(v, [...path, 'value']);
      if (!keyR.success) issues.push(...keyR.error.issues);
      if (!valR.success) issues.push(...valR.error.issues);
      if (keyR.success && valR.success) result.set(keyR.data, valR.data);
    }

    if (issues.length > 0) return { success: false, error: new ZodError(issues) };
    return { success: true, data: result };
  }
}

export class DhiSet<T extends DhiType<any, any>> extends DhiType<Set<T["_output"]>, Set<T["_input"]>> {
  private checks: Array<{ type: string; value?: number; message?: string }> = [];

  constructor(private valueSchema: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<Set<T["_output"]>> {
    const fast = jitTryFast(this, value);
    if (fast) return fast;
    if (!(value instanceof Set)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected Set' }]) };
    }

    for (const check of this.checks) {
      if (check.type === 'min' && value.size < check.value!) return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `Set must have at least ${check.value} elements` }]) };
      if (check.type === 'max' && value.size > check.value!) return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || `Set must have at most ${check.value} elements` }]) };
      if (check.type === 'size' && value.size !== check.value!) return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `Set must have exactly ${check.value} elements` }]) };
      if (check.type === 'nonempty' && value.size === 0) return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || 'Set must not be empty' }]) };
    }

    const result = new Set<T["_output"]>();
    const issues: ZodIssue[] = [];

    for (const item of value) {
      const r = this.valueSchema._parse(item, path);
      if (!r.success) issues.push(...r.error.issues);
      else result.add(r.data);
    }

    if (issues.length > 0) return { success: false, error: new ZodError(issues) };
    return { success: true, data: result };
  }

  min(size: number, message?: string): this { return this._withCheck({ type: 'min', value: size, message }); }
  max(size: number, message?: string): this { return this._withCheck({ type: 'max', value: size, message }); }
  size(size: number, message?: string): this { return this._withCheck({ type: 'size', value: size, message }); }
  nonempty(message?: string): this { return this._withCheck({ type: 'nonempty', message }); }
}

// ============================================================================
// Union & Discriminated Union & Intersection
// ============================================================================

type UnionOutput<T extends DhiType<any, any>[]> = T[number]["_output"];
type UnionInput<T extends DhiType<any, any>[]> = T[number]["_input"];

export class DhiUnion<T extends [DhiType<any, any>, ...DhiType<any, any>[]]> extends DhiType<UnionOutput<T>, UnionInput<T>> {
  constructor(private options: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<UnionOutput<T>> {
    const fast = jitTryFast(this, value);
    if (fast) return fast;
    const options = this.options;
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      // Cheap probe first: a definite-miss is skipped without building a
      // ZodError (the old code _parse'd every option and spread its issues,
      // which were then discarded — pure waste). Only confirm/transform when
      // the probe says yes or "don't know".
      if (option._fastValid(value) === false) continue;
      const result = option._parse(value, path);
      if (result.success) return result;
    }
    return { success: false, error: new ZodError([{ code: 'invalid_union', path, message: 'Invalid input' }]) };
  }

  protected _toJsonSchemaCore(): Record<string, any> {
    return { anyOf: this.options.map(opt => opt.toJsonSchema()) };
  }
}

export class DhiDiscriminatedUnion<
  Discriminator extends string,
  Options extends [DhiObject<any>, ...DhiObject<any>[]]
> extends DhiType<Options[number]["_output"], Options[number]["_input"]> {
  private _optionsMap: Map<any, DhiObject<any>>;
  private _jit: ((value: any) => any) | null | undefined = undefined;

  constructor(private discriminator: Discriminator, private options: Options) {
    super();
    this._optionsMap = new Map();
    for (const option of options) {
      const schema = option.shape[discriminator];
      if (schema instanceof DhiLiteral) {
        this._optionsMap.set((schema as any).value, option);
      }
    }
  }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<Options[number]["_output"]> {
    if (this._jit === undefined) this._jit = jitCompileValueFn(this);
    if (this._jit) {
      const r = this._jit(value);
      if (r !== null) return { success: true, data: r };
    }

    if (typeof value !== 'object' || value === null) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected object' }]) };
    }

    const discriminatorValue = (value as any)[this.discriminator];
    const option = this._optionsMap.get(discriminatorValue);

    if (!option) {
      return { success: false, error: new ZodError([{ code: 'invalid_union_discriminator', path: [...path, this.discriminator], message: `Invalid discriminator value` }]) };
    }

    return option._parse(value, path);
  }
}

export class DhiIntersection<L extends DhiType<any, any>, R extends DhiType<any, any>> extends DhiType<L["_output"] & R["_output"], L["_input"] & R["_input"]> {
  constructor(private left: L, private right: R) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<L["_output"] & R["_output"]> {
    const fast = jitTryFast(this, value);
    if (fast) return fast;
    const leftResult = this.left._parse(value, path);
    if (!leftResult.success) return leftResult as any;

    const rightResult = this.right._parse(value, path);
    if (!rightResult.success) return rightResult as any;

    // Merge results
    if (typeof leftResult.data === 'object' && typeof rightResult.data === 'object') {
      return { success: true, data: { ...leftResult.data, ...rightResult.data } };
    }

    return { success: true, data: leftResult.data };
  }
}

// ============================================================================
// Lazy (recursive schemas)
// ============================================================================

export class DhiLazy<T extends DhiType<any, any>> extends DhiType<T["_output"], T["_input"]> {
  constructor(private getter: () => T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"]> {
    const fast = jitTryFast(this, value);
    if (fast) return fast;
    return this.getter()._parse(value, path);
  }
}

// ============================================================================
// Promise Schema
// ============================================================================

export class DhiPromise<T extends DhiType<any, any>> extends DhiType<Promise<T["_output"]>, Promise<T["_input"]>> {
  constructor(private schema: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<Promise<T["_output"]>> {
    if (!(value instanceof Promise)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected Promise' }]) };
    }
    // We can't validate the resolved value synchronously
    const validated = value.then(v => this.schema.parse(v));
    return { success: true, data: validated };
  }
}

// ============================================================================
// Function Schema
// ============================================================================

export class DhiFunction<
  Args extends DhiTuple<any> | DhiType<any, any>,
  Returns extends DhiType<any, any>
> extends DhiType<(...args: any[]) => any, (...args: any[]) => any> {
  private _args?: Args;
  private _returns?: Returns;

  args<A extends DhiTuple<any>>(schema: A): DhiFunction<A, Returns> {
    const fn = new DhiFunction<A, Returns>();
    (fn as any)._args = schema;
    (fn as any)._returns = this._returns;
    return fn;
  }

  returns<R extends DhiType<any, any>>(schema: R): DhiFunction<Args, R> {
    const fn = new DhiFunction<Args, R>();
    (fn as any)._args = this._args;
    (fn as any)._returns = schema;
    return fn;
  }

  implement(fn: (...args: any[]) => any): (...args: any[]) => any {
    return (...args: any[]) => {
      if (this._args) this._args.parse(args);
      const result = fn(...args);
      if (this._returns) return this._returns.parse(result);
      return result;
    };
  }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<any> {
    if (typeof value !== 'function') {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected function' }]) };
    }
    return { success: true, data: value };
  }
}

// ============================================================================
// instanceof
// ============================================================================

export class DhiInstanceOf<T extends abstract new (...args: any[]) => any> extends DhiType<InstanceType<T>, InstanceType<T>> {
  constructor(private cls: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<InstanceType<T>> {
    if (!(value instanceof this.cls)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: `Expected instance of ${this.cls.name}` }]) };
    }
    return { success: true, data: value as InstanceType<T> };
  }
}

// ============================================================================
// Modifiers: Optional, Nullable, Default, Catch, Transform, Refine, Pipe, Readonly
// ============================================================================

export class DhiOptional<T extends DhiType<any, any>> extends DhiType<T["_output"] | undefined, T["_input"] | undefined> {
  constructor(private _inner: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"] | undefined> {
    if (value === undefined) return { success: true, data: undefined };
    return this._inner._parse(value, path);
  }

  unwrap(): T { return this._inner; }
  isOptional() { return true; }

  protected _toJsonSchemaCore(): Record<string, any> {
    return this._inner.toJsonSchema();
  }
}

export class DhiNullable<T extends DhiType<any, any>> extends DhiType<T["_output"] | null, T["_input"] | null> {
  constructor(private _inner: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"] | null> {
    if (value === null) return { success: true, data: null };
    return this._inner._parse(value, path);
  }

  unwrap(): T { return this._inner; }
  isNullable() { return true; }

  protected _toJsonSchemaCore(): Record<string, any> {
    const inner = this._inner.toJsonSchema();
    return { anyOf: [inner, { type: 'null' }] };
  }
}

export class DhiDefault<T extends DhiType<any, any>> extends DhiType<T["_output"], T["_input"] | undefined> {
  constructor(private _inner: T, private _default: T["_output"] | (() => T["_output"])) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"]> {
    if (value === undefined) {
      const def = typeof this._default === 'function' ? (this._default as Function)() : this._default;
      return { success: true, data: def };
    }
    return this._inner._parse(value, path);
  }

  removeDefault(): T { return this._inner; }

  protected _toJsonSchemaCore(): Record<string, any> {
    const schema = this._inner.toJsonSchema();
    const def = typeof this._default === 'function' ? (this._default as Function)() : this._default;
    if (def !== undefined) schema.default = def;
    return schema;
  }
}

export class DhiCatch<T extends DhiType<any, any>> extends DhiType<T["_output"], unknown> {
  constructor(private _inner: T, private _catch: T["_output"] | (() => T["_output"])) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"]> {
    const result = this._inner._parse(value, path);
    if (result.success) return result;
    const catchVal = typeof this._catch === 'function' ? (this._catch as Function)() : this._catch;
    return { success: true, data: catchVal };
  }

  removeCatch(): T { return this._inner; }
}

export class DhiTransform<T extends DhiType<any, any>, U> extends DhiType<U, T["_input"]> {
  constructor(private _inner: T, private _transform: (value: T["_output"]) => U) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<U> {
    const result = this._inner._parse(value, path);
    if (!result.success) return result as any;
    try {
      return { success: true, data: this._transform(result.data) };
    } catch (e: any) {
      return { success: false, error: new ZodError([{ code: 'custom', path, message: e?.message || 'Transform failed' }]) };
    }
  }
}

export class DhiRefine<T extends DhiType<any, any>> extends DhiType<T["_output"], T["_input"]> {
  constructor(private _inner: T, private _check: (value: T["_output"]) => boolean, private _message?: string, private _path?: (string | number)[]) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"]> {
    const fast = jitTryFast(this, value);
    if (fast) return fast;
    const result = this._inner._parse(value, path);
    if (!result.success) return result;
    if (!this._check(result.data)) {
      return { success: false, error: new ZodError([{ code: 'custom', path: this._path ? [...path, ...this._path] : path, message: this._message || 'Invalid value' }]) };
    }
    return result;
  }
}

export class DhiSuperRefine<T extends DhiType<any, any>> extends DhiType<T["_output"], T["_input"]> {
  constructor(private _inner: T, private _refinement: (value: T["_output"], ctx: { addIssue: (issue: Partial<ZodIssue>) => void }) => void) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"]> {
    const fast = jitTryFast(this, value);
    if (fast) return fast;
    const result = this._inner._parse(value, path);
    if (!result.success) return result;

    const issues: ZodIssue[] = [];
    const ctx = {
      addIssue: (issue: Partial<ZodIssue>) => {
        issues.push({ code: issue.code || 'custom', path: issue.path || path, message: issue.message || 'Invalid' });
      }
    };

    this._refinement(result.data, ctx);

    if (issues.length > 0) return { success: false, error: new ZodError(issues) };
    return result;
  }
}

/** A `.check()` argument: payload check fn, Zod-style check object, or superRefine-style callback */
export type DhiCheckInput<T = any> =
  | ((payload: ZodParsePayload & { value: T }) => void)
  | DhiCheckObject
  | ((value: T, ctx: { addIssue: (issue: Partial<ZodIssue>) => void }) => void);

/** Zod 4 `$ZodCheck`-shaped check object (what `z.lowercase()`, `z.minLength(n)`, ... return) */
export interface DhiCheckObject {
  _zod: {
    def: { check: string; [key: string]: any };
    check: (payload: ZodParsePayload) => void;
    onattach?: any[];
  };
}

function toPayloadCheck(c: DhiCheckInput): (payload: ZodParsePayload) => void {
  if (typeof c === 'function') {
    if (c.length >= 2) {
      // superRefine-style (value, ctx) callback
      const fn = c as (value: any, ctx: { addIssue: (issue: Partial<ZodIssue>) => void }) => void;
      return payload => fn(payload.value, {
        addIssue: issue => payload.issues.push({ code: 'custom', message: 'Invalid input', input: payload.value, ...issue }),
      });
    }
    return c as (payload: ZodParsePayload) => void;
  }
  if (c && typeof c === 'object' && c._zod && typeof c._zod.check === 'function') {
    const fn = c._zod.check;
    return payload => fn(payload);
  }
  throw new Error('check(): expected a check function or a Zod check object');
}

/** Zod 4 `.check(...)` wrapper: runs the inner schema, then each check against the parse payload */
export class DhiCheck<T extends DhiType<any, any>> extends DhiType<T["_output"], T["_input"]> {
  private _fns: Array<(payload: ZodParsePayload) => void>;

  constructor(private _inner: T, private _checks: DhiCheckInput[]) {
    super();
    this._fns = _checks.map(toPayloadCheck);
  }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"]> {
    const result = this._inner._parse(value, path);
    if (!result.success) return result;
    const payload: ZodParsePayload = { value: result.data, issues: [] };
    const fns = this._fns;
    for (let i = 0; i < fns.length; i++) {
      fns[i](payload);
      if (payload.aborted) break;
    }
    if (payload.issues.length === 0) return { success: true, data: payload.value };
    const issues: ZodIssue[] = payload.issues.map((iss: any) => ({
      ...iss,
      code: (iss.code ?? 'custom') as ZodIssueCode,
      path: iss.path ? [...path, ...iss.path] : path,
      message: iss.message ?? 'Invalid input',
    }));
    return { success: false, error: new ZodError(issues) };
  }

  /** @internal Zod 4 `$ZodCheck` descriptors for `_zod.def.checks` */
  _zodChecks(): any[] {
    return this._checks.map(c => (typeof c === 'function' ? zodCheck('custom', { fn: c }) : c));
  }
}

export class DhiPipe<A extends DhiType<any, any>, B extends DhiType<any, any>> extends DhiType<B["_output"], A["_input"]> {
  constructor(private _a: A, private _b: B) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<B["_output"]> {
    const fast = jitTryFast(this, value);
    if (fast) return fast;
    const aResult = this._a._parse(value, path);
    if (!aResult.success) return aResult as any;
    return this._b._parse(aResult.data, path);
  }
}

export class DhiReadonly<T extends DhiType<any, any>> extends DhiType<Readonly<T["_output"]>, T["_input"]> {
  constructor(private _inner: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<Readonly<T["_output"]>> {
    const result = this._inner._parse(value, path);
    if (!result.success) return result;
    if (typeof result.data === 'object' && result.data !== null) {
      return { success: true, data: Object.freeze(result.data) };
    }
    return result as SafeParseResult<Readonly<T["_output"]>>;
  }
}

// ============================================================================
// Preprocess & Effects
// ============================================================================

export class DhiPreprocess<T extends DhiType<any, any>> extends DhiType<T["_output"], unknown> {
  constructor(private _preprocess: (value: unknown) => unknown, private _schema: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"]> {
    const processed = this._preprocess(value);
    return this._schema._parse(processed, path);
  }
}

// ============================================================================
// File Schema (Zod 4)
// ============================================================================

export class DhiFile extends DhiType<File, File> {
  private checks: Array<{ type: string; value?: any; message?: string }> = [];

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<File> {
    if (!(value instanceof File)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected File' }]) };
    }

    for (const check of this.checks) {
      switch (check.type) {
        case 'min':
          if (value.size < check.value)
            return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `File must be at least ${check.value} bytes` }]) };
          break;
        case 'max':
          if (value.size > check.value)
            return { success: false, error: new ZodError([{ code: 'too_big', path, message: check.message || `File must be at most ${check.value} bytes` }]) };
          break;
        case 'mime':
          const mimes = Array.isArray(check.value) ? check.value : [check.value];
          // Handle MIME types with parameters (e.g., "text/plain;charset=utf-8")
          const baseType = value.type.split(';')[0].trim();
          if (!mimes.some((m: string) => baseType === m || value.type === m))
            return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: check.message || `Invalid MIME type. Expected ${mimes.join(', ')}` }]) };
          break;
      }
    }

    return { success: true, data: value };
  }

  min(size: number, message?: string): this { return this._withCheck({ type: 'min', value: size, message }); }
  max(size: number, message?: string): this { return this._withCheck({ type: 'max', value: size, message }); }
  mime(types: string | string[], message?: string): this { return this._withCheck({ type: 'mime', value: types, message }); }
}

// ============================================================================
// Template Literal Schema (Zod 4)
// ============================================================================

export class DhiTemplateLiteral<T extends string = string> extends DhiType<T, T> {
  private _regex: RegExp;
  private _parts: Array<string | DhiType<any, any>>;

  constructor(parts: Array<string | DhiType<any, any>>) {
    super();
    this._parts = parts;
    // Build regex from parts
    let pattern = '^';
    for (const part of parts) {
      if (typeof part === 'string') {
        pattern += part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      } else {
        // Generic pattern for schema types
        if (part instanceof DhiString) {
          pattern += '.*';
        } else if (part instanceof DhiNumber) {
          pattern += '-?\\d+(?:\\.\\d+)?';
        } else if (part instanceof DhiLiteral) {
          pattern += String((part as any).value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        } else if (part instanceof DhiEnum) {
          pattern += `(?:${(part as any).options.map((v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
        } else {
          pattern += '.*';
        }
      }
    }
    pattern += '$';
    this._regex = new RegExp(pattern);
  }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T> {
    if (typeof value !== 'string') {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected string' }]) };
    }
    if (!this._regex.test(value)) {
      return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: 'Invalid template literal format' }]) };
    }
    return { success: true, data: value as T };
  }
}

// ============================================================================
// Coercion Schemas
// ============================================================================

class DhiCoercedString extends DhiString {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<string> {
    return super._parse(String(value), path);
  }
}

class DhiCoercedNumber extends DhiNumber {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<number> {
    return super._parse(Number(value), path);
  }
}

class DhiCoercedBoolean extends DhiBoolean {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<boolean> {
    return super._parse(Boolean(value), path);
  }
}

class DhiCoercedBigInt extends DhiBigInt {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<bigint> {
    try {
      return super._parse(BigInt(value as any), path);
    } catch {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Cannot coerce to bigint' }]) };
    }
  }
}

class DhiCoercedDate extends DhiDate {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<Date> {
    // Zod: `new Date(value)` for any input (a throwing input, e.g. a Symbol, stays as is)
    if (value instanceof Date) return super._parse(value, path);
    let coerced: unknown = value;
    try {
      coerced = new Date(value as any);
    } catch {
      /* leave as is: rejected by the type check below */
    }
    return super._parse(coerced, path);
  }
}

// ============================================================================
// StringBool (Zod 4 feature)
// ============================================================================

export class DhiStringBool extends DhiType<boolean, string> {
  private _trueValues: Set<string>;
  private _falseValues: Set<string>;
  private _caseSensitive: boolean;

  constructor(opts?: { truthy?: string[]; falsy?: string[]; case?: 'sensitive' | 'insensitive' }) {
    super();
    this._caseSensitive = opts?.case === 'sensitive';
    const norm = (values: string[]) => new Set(this._caseSensitive ? values : values.map(v => v.toLowerCase()));
    // Same defaults as Zod 4
    this._trueValues = norm(opts?.truthy ?? ['true', '1', 'yes', 'on', 'y', 'enabled']);
    this._falseValues = norm(opts?.falsy ?? ['false', '0', 'no', 'off', 'n', 'disabled']);
  }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<boolean> {
    if (typeof value !== 'string') {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected string, received ' + typeof value }]) };
    }
    const v = this._caseSensitive ? value : value.toLowerCase();
    if (this._trueValues.has(v)) return { success: true, data: true };
    if (this._falseValues.has(v)) return { success: true, data: false };
    return { success: false, error: new ZodError([{ code: 'invalid_value', path, message: `Invalid option: expected one of ${[...this._trueValues, ...this._falseValues].map(s => `"${s}"`).join('|')}` }]) };
  }
}

// ============================================================================
// Custom Schema
// ============================================================================

export class DhiCustom<T> extends DhiType<T, unknown> {
  private _checkFn: (value: unknown) => value is T;
  private _params?: { message?: string };
  constructor(checkFn: (value: unknown) => value is T, params?: { message?: string }) {
    super();
    this._checkFn = checkFn;
    this._params = params;
  }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T> {
    if (this._checkFn(value)) return { success: true, data: value };
    return { success: false, error: new ZodError([{ code: 'custom', path, message: this._params?.message || 'Invalid value' }]) };
  }
}

// ============================================================================
// Success Wrapper (Zod 4)
// ============================================================================

export class DhiSuccess<T extends DhiType<any, any>> extends DhiType<boolean, T["_input"]> {
  constructor(private _inner: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<boolean> {
    // Zod 4 semantics: the inner schema's issues propagate, so a failing inner
    // schema fails the parse; a passing one yields `true`.
    const result = this._inner._parse(value, path);
    if (!result.success) return result as any;
    return { success: true, data: true };
  }
}

/** Zod 4 `.nonoptional()`: like the inner schema but `undefined` is rejected */
export class DhiNonOptional<T extends DhiType<any, any>> extends DhiType<Exclude<T["_output"], undefined>, Exclude<T["_input"], undefined>> {
  constructor(private _inner: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<Exclude<T["_output"], undefined>> {
    const result = this._inner._parse(value, path);
    if (!result.success) return result as any;
    if (result.data === undefined) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected nonoptional, received undefined', expected: 'nonoptional', received: 'undefined' }]) };
    }
    return result as any;
  }

  unwrap(): T { return this._inner; }

  protected _toJsonSchemaCore(): Record<string, any> {
    return this._inner.toJsonSchema();
  }
}

/**
 * Zod 4 `.exactOptional()`: the object key may be absent, but when present the
 * value must satisfy the inner schema (an explicit `undefined` is rejected).
 */
export class DhiExactOptional<T extends DhiType<any, any>> extends DhiType<T["_output"], T["_input"]> {
  /** Type-level marker: the object key is optional even though the value type excludes undefined */
  readonly _optionalKey!: true;

  constructor(private _inner: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"]> {
    return this._inner._parse(value, path);
  }

  unwrap(): T { return this._inner; }

  protected _toJsonSchemaCore(): Record<string, any> {
    return this._inner.toJsonSchema();
  }
}

// ============================================================================
// Registry System (Zod 4)
// ============================================================================

export interface GlobalMeta {
  id?: string;
  title?: string;
  description?: string;
  deprecated?: boolean;
  [key: string]: any;
}

export class DhiRegistry<M extends Record<string, any> = GlobalMeta> {
  private _schemas = new WeakMap<DhiType<any, any>, M>();

  add<T extends DhiType<any, any>>(schema: T, metadata: M): T {
    this._schemas.set(schema, metadata);
    return schema;
  }

  get<T extends DhiType<any, any>>(schema: T): M | undefined {
    return this._schemas.get(schema);
  }

  has<T extends DhiType<any, any>>(schema: T): boolean {
    return this._schemas.has(schema);
  }

  remove<T extends DhiType<any, any>>(schema: T): boolean {
    return this._schemas.delete(schema);
  }
}

// Global registry instance
export const globalRegistry = new DhiRegistry<GlobalMeta>();

// Add register method to base schema type
DhiType.prototype.register = function<M extends GlobalMeta>(this: DhiType<any, any>, metadata: M): typeof this {
  globalRegistry.add(this, metadata);
  return this;
};

// Extend DhiType to include register method type
declare module './schema-core' {
  interface DhiType<Output, Input> {
    register(metadata: GlobalMeta): this;
  }
}

// ============================================================================
// JSON Schema import — "define once, hydrate anywhere" (Issue #55, Proposal B)
// The inverse of `.toJsonSchema()`: build a dhi schema from a JSON Schema doc so
// a single schema (e.g. a shared `*.schema.json`) can drive both the Python and
// TS bindings identically. Mirrors the mappings in the `_toJsonSchemaCore()`
// overrides above.
// ============================================================================

export interface FromJsonSchemaOptions {
  /**
   * Root document used to resolve local `$ref`s (e.g. `#/$defs/Foo`).
   * Defaults to the schema passed to `fromJsonSchema`.
   */
  root?: Record<string, any>;
}

function _resolveRef(ref: string, root: Record<string, any>): any {
  if (!ref.startsWith('#')) {
    throw new Error(`dhi.fromJsonSchema: only local $ref (starting with '#') are supported, got '${ref}'`);
  }
  const parts = ref
    .slice(1)
    .split('/')
    .filter(Boolean)
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node: any = root;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') {
      throw new Error(`dhi.fromJsonSchema: could not resolve $ref '${ref}'`);
    }
    node = node[part];
  }
  if (node === undefined) throw new Error(`dhi.fromJsonSchema: could not resolve $ref '${ref}'`);
  return node;
}

function _withMeta(node: any, schema: DhiType<any, any>): DhiType<any, any> {
  let out = schema;
  if (typeof node.description === 'string') out = out.describe(node.description);
  if ('default' in node) out = out.default(node.default);
  return out;
}

function _buildString(node: any): DhiType<any, any> {
  let s = new DhiString();
  if (typeof node.minLength === 'number') s = s.min(node.minLength);
  if (typeof node.maxLength === 'number') s = s.max(node.maxLength);
  if (typeof node.pattern === 'string') s = s.regex(new RegExp(node.pattern));
  switch (node.format) {
    case 'email': s = s.email(); break;
    case 'uri':
    case 'url': s = s.url(); break;
    case 'uuid': s = s.uuid(); break;
    case 'date-time': s = s.datetime(); break;
    case 'date': s = s.date(); break;
    case 'time': s = s.time(); break;
    case 'duration': s = s.duration(); break;
    case 'ipv4': s = s.ipv4(); break;
    case 'ipv6': s = s.ipv6(); break;
  }
  return s;
}

function _buildNumber(node: any, isInt: boolean): DhiType<any, any> {
  let n = new DhiNumber();
  if (isInt) n = n.int();
  if (typeof node.minimum === 'number') n = n.min(node.minimum);
  if (typeof node.maximum === 'number') n = n.max(node.maximum);
  if (typeof node.exclusiveMinimum === 'number') n = n.gt(node.exclusiveMinimum);
  if (typeof node.exclusiveMaximum === 'number') n = n.lt(node.exclusiveMaximum);
  if (typeof node.multipleOf === 'number') n = n.multipleOf(node.multipleOf);
  return n;
}

function _buildArray(node: any, root: Record<string, any>, seen: Map<any, DhiType<any, any>>): DhiType<any, any> {
  const items = node.items && !Array.isArray(node.items)
    ? _jsonSchemaToDhi(node.items, root, seen)
    : new DhiAny();
  let a = new DhiArray(items as any);
  if (typeof node.minItems === 'number') a = a.min(node.minItems);
  if (typeof node.maxItems === 'number') a = a.max(node.maxItems);
  return a;
}

function _buildObject(node: any, root: Record<string, any>, seen: Map<any, DhiType<any, any>>): DhiType<any, any> {
  const props = node.properties || {};
  const required: string[] = Array.isArray(node.required) ? node.required : [];
  const shape: Record<string, DhiType<any, any>> = {};
  for (const key of Object.keys(props)) {
    let field = _jsonSchemaToDhi(props[key], root, seen);
    if (!required.includes(key)) field = field.optional();
    shape[key] = field;
  }
  let obj = new DhiObject(shape);
  if (node.additionalProperties === false) obj = obj.strict();
  return obj;
}

function _jsonSchemaToDhi(node: any, root: Record<string, any>, seen: Map<any, DhiType<any, any>>): DhiType<any, any> {
  // Boolean schemas: `true` accepts anything, `false` accepts nothing.
  if (node === true) return new DhiAny();
  if (node === false) return new DhiNever();
  if (node == null || typeof node !== 'object') return new DhiAny();

  // $ref (local only) — guard cycles with a lazy thunk.
  if (typeof node.$ref === 'string') {
    const target = _resolveRef(node.$ref, root);
    if (seen.has(target)) {
      const cached = seen.get(target)!;
      return new DhiLazy(() => cached);
    }
    return _jsonSchemaToDhi(target, root, seen);
  }

  // Combinators.
  const variants = node.anyOf || node.oneOf;
  if (Array.isArray(variants)) {
    const opts = variants.map((s: any) => _jsonSchemaToDhi(s, root, seen));
    const schema = opts.length === 1 ? opts[0] : new DhiUnion(opts as any);
    return _withMeta(node, schema);
  }
  if (Array.isArray(node.allOf)) {
    const parts = node.allOf.map((s: any) => _jsonSchemaToDhi(s, root, seen));
    const schema = parts.reduce((acc: DhiType<any, any>, cur: DhiType<any, any>) => new DhiIntersection(acc, cur));
    return _withMeta(node, schema);
  }

  // const / enum.
  if ('const' in node) return _withMeta(node, new DhiLiteral(node.const));
  if (Array.isArray(node.enum)) {
    const vals: any[] = node.enum;
    if (vals.length > 0 && vals.every((v) => typeof v === 'string')) {
      return _withMeta(node, new DhiEnum(vals as [string, ...string[]]));
    }
    const lits = vals.map((v) => new DhiLiteral(v));
    return _withMeta(node, lits.length === 1 ? lits[0] : new DhiUnion(lits as any));
  }

  // type — may be an array (e.g. ["string", "null"]) or include OpenAPI nullable.
  let type = node.type;
  let nullable = node.nullable === true;
  if (Array.isArray(type)) {
    const nonNull = type.filter((t: string) => t !== 'null');
    if (type.includes('null')) nullable = true;
    if (nonNull.length === 1) {
      type = nonNull[0];
    } else {
      const opts = nonNull.map((t: string) => _jsonSchemaToDhi({ ...node, type: t, nullable: undefined }, root, seen));
      let schema: DhiType<any, any> = opts.length === 1 ? opts[0] : new DhiUnion(opts as any);
      if (nullable) schema = new DhiNullable(schema);
      return _withMeta(node, schema);
    }
  }

  let schema: DhiType<any, any>;
  switch (type) {
    case 'string': schema = _buildString(node); break;
    case 'integer': schema = _buildNumber(node, true); break;
    case 'number': schema = _buildNumber(node, false); break;
    case 'boolean': schema = new DhiBoolean(); break;
    case 'null': schema = new DhiNull(); break;
    case 'array': schema = _buildArray(node, root, seen); break;
    case 'object': schema = _buildObject(node, root, seen); break;
    default:
      // No explicit type: infer object when shape-like, otherwise accept anything.
      schema = (node.properties || node.required) ? _buildObject(node, root, seen) : new DhiAny();
  }
  if (nullable) schema = new DhiNullable(schema);
  return _withMeta(node, schema);
}

/**
 * Build a dhi schema from a JSON Schema document — the inverse of
 * `schema.toJsonSchema()`. Supports objects/arrays/strings/numbers/booleans,
 * enums, const, `anyOf`/`oneOf`/`allOf`, local `$ref` (`#/$defs/...`),
 * nullable (`type: [..., "null"]` and OpenAPI `nullable: true`), and the same
 * string/number constraints dhi emits.
 *
 * @example
 *   const Chat = z.fromJsonSchema(chatRequestSchema);
 *   Chat.parse(await req.json());
 */
export function fromJsonSchema(doc: Record<string, any>, options?: FromJsonSchemaOptions): DhiType<any, any> {
  const root = options?.root ?? doc;
  return _jsonSchemaToDhi(doc, root, new Map());
}

// ============================================================================
// Main Export: z namespace (Zod 4 compatible)
// ============================================================================

// ============================================================================
// Standalone checks for `.check(...)` — Zod 4's z.minLength(), z.lowercase(), ...
// ============================================================================

function makeCheck(def: { check: string; [key: string]: any }, check: (payload: ZodParsePayload) => void): DhiCheckObject {
  return { _zod: { def, check, onattach: [] } };
}

function pushIssue(payload: ZodParsePayload, issue: Record<string, any>): void {
  payload.issues.push({ input: payload.value, ...issue });
}

function stringFormatCheck(format: string, re: RegExp, message?: ZodMessage): DhiCheckObject {
  const msg = msgOf(message);
  return makeCheck({ check: 'string_format', format, pattern: re }, payload => {
    re.lastIndex = 0;
    if (typeof payload.value !== 'string' || !re.test(payload.value)) {
      pushIssue(payload, { code: 'invalid_format', format, message: msg ?? `Invalid ${format}` });
    }
  });
}

function substringCheck(format: 'includes' | 'starts_with' | 'ends_with', needle: string, position: number | undefined, message?: ZodMessage): DhiCheckObject {
  const msg = msgOf(message);
  const def: { check: string; [key: string]: any } = { check: 'string_format', format };
  if (format === 'includes') { def.includes = needle; def.position = position; }
  else if (format === 'starts_with') def.prefix = needle;
  else def.suffix = needle;
  return makeCheck(def, payload => {
    const v = payload.value;
    const ok = typeof v === 'string' && (
      format === 'includes' ? v.includes(needle, position) : format === 'starts_with' ? v.startsWith(needle) : v.endsWith(needle));
    if (!ok) pushIssue(payload, { code: 'invalid_format', format, message: msg ?? `Invalid string: must ${format.replace('_', ' ')} "${needle}"` });
  });
}

function lengthCheck(kind: 'min_length' | 'max_length' | 'length_equals', n: number, message?: ZodMessage): DhiCheckObject {
  const msg = msgOf(message);
  const def = kind === 'min_length' ? { check: kind, minimum: n } : kind === 'max_length' ? { check: kind, maximum: n } : { check: kind, length: n };
  return makeCheck(def, payload => {
    const len = payload.value?.length;
    if (typeof len !== 'number') return;
    if (kind === 'min_length' && len < n) pushIssue(payload, { code: 'too_small', minimum: n, inclusive: true, message: msg ?? `Too small: expected length >= ${n}` });
    else if (kind === 'max_length' && len > n) pushIssue(payload, { code: 'too_big', maximum: n, inclusive: true, message: msg ?? `Too big: expected length <= ${n}` });
    else if (kind === 'length_equals' && len !== n) pushIssue(payload, { code: len < n ? 'too_small' : 'too_big', message: msg ?? `Invalid length: expected exactly ${n}` });
  });
}

function sizeCheck(kind: 'min_size' | 'max_size' | 'size_equals', n: number, message?: ZodMessage): DhiCheckObject {
  const msg = msgOf(message);
  const def = kind === 'min_size' ? { check: kind, minimum: n } : kind === 'max_size' ? { check: kind, maximum: n } : { check: kind, size: n };
  return makeCheck(def, payload => {
    const size = payload.value?.size;
    if (typeof size !== 'number') return;
    if (kind === 'min_size' && size < n) pushIssue(payload, { code: 'too_small', minimum: n, inclusive: true, message: msg ?? `Too small: expected size >= ${n}` });
    else if (kind === 'max_size' && size > n) pushIssue(payload, { code: 'too_big', maximum: n, inclusive: true, message: msg ?? `Too big: expected size <= ${n}` });
    else if (kind === 'size_equals' && size !== n) pushIssue(payload, { code: size < n ? 'too_small' : 'too_big', message: msg ?? `Invalid size: expected exactly ${n}` });
  });
}

function numberCheck(kind: 'greater_than' | 'less_than', bound: number | bigint, inclusive: boolean, message?: ZodMessage): DhiCheckObject {
  const msg = msgOf(message);
  return makeCheck({ check: kind, value: bound, inclusive }, payload => {
    const v = payload.value;
    if (typeof v !== 'number' && typeof v !== 'bigint' && !(v instanceof Date)) return;
    const x: any = v instanceof Date ? v.getTime() : v;
    const ok = kind === 'greater_than' ? (inclusive ? x >= bound : x > bound) : (inclusive ? x <= bound : x < bound);
    if (!ok) {
      pushIssue(payload, kind === 'greater_than'
        ? { code: 'too_small', minimum: bound, inclusive, message: msg ?? `Too small: expected ${inclusive ? '>=' : '>'} ${bound}` }
        : { code: 'too_big', maximum: bound, inclusive, message: msg ?? `Too big: expected ${inclusive ? '<=' : '<'} ${bound}` });
    }
  });
}

function overwriteCheck(tx: (value: any) => any): DhiCheckObject {
  return makeCheck({ check: 'overwrite', tx }, payload => { payload.value = tx(payload.value); });
}

// z.enum: tuple form keeps literal inference via a `const` type parameter (overload 1);
// object form is a native enum (overload 2)
function enumFactory<const T extends readonly [string, ...string[]]>(values: T): DhiEnum<T>;
function enumFactory<T extends Record<string, string | number>>(values: T): DhiNativeEnum<T>;
function enumFactory(values: any): any {
  return Array.isArray(values) ? new DhiEnum(values as any) : new DhiNativeEnum(values);
}

export const z = {
  // Primitives
  string: () => new DhiString(),
  number: () => new DhiNumber(),
  bigint: () => new DhiBigInt(),
  boolean: () => new DhiBoolean(),
  date: () => new DhiDate(),
  symbol: () => new DhiSymbol(),
  undefined: () => new DhiUndefined(),
  null: () => new DhiNull(),
  void: () => new DhiVoid(),
  never: () => new DhiNever(),
  any: () => new DhiAny(),
  unknown: () => new DhiUnknown(),
  nan: () => new DhiNaN(),

  // Literals & Enums
  literal: <T extends string | number | boolean | bigint | null | undefined>(value: T) => new DhiLiteral(value),
  // Zod 4: z.enum([...]) or z.enum({ Key: 'value' }) (object form = nativeEnum)
  enum: enumFactory,
  nativeEnum: <T extends Record<string, string | number>>(enumObj: T) => new DhiNativeEnum(enumObj),

  // Composites
  object: <T extends Record<string, DhiType<any, any>>>(shape: T) => new DhiObject(shape),
  array: <T extends DhiType<any, any>>(schema: T) => new DhiArray(schema),
  tuple: <T extends [DhiType<any, any>, ...DhiType<any, any>[]]>(items: T) => new DhiTuple(items),
  record: <K extends DhiType<string, string>, V extends DhiType<any, any>>(keyOrValue: K | V, value?: V) => {
    if (value) return new DhiRecord(keyOrValue as K, value);
    return new DhiRecord(new DhiString() as any, keyOrValue as V);
  },
  // Zod 4: partialRecord - enum/literal keys may be missing (plain `record` with such keys is exhaustive)
  partialRecord: <K extends DhiType<string, string>, V extends DhiType<any, any>>(keySchema: K, valueSchema: V) => {
    const record = new DhiRecord(keySchema, valueSchema);
    record._partial = true;
    return record as unknown as DhiType<Partial<Record<K["_output"], V["_output"]>>, Partial<Record<K["_input"], V["_input"]>>>;
  },
  // Zod 4: looseRecord - allows non-matching keys to pass through
  looseRecord: <K extends DhiType<string, string>, V extends DhiType<any, any>>(keySchema: K, valueSchema: V) =>
    new DhiRecord(keySchema, valueSchema),
  map: <K extends DhiType<any, any>, V extends DhiType<any, any>>(keySchema: K, valueSchema: V) => new DhiMap(keySchema, valueSchema),
  set: <T extends DhiType<any, any>>(schema: T) => new DhiSet(schema),

  // Unions & Intersections
  union: <T extends [DhiType<any, any>, ...DhiType<any, any>[]]>(options: T) => new DhiUnion(options),
  discriminatedUnion: <D extends string, T extends [DhiObject<any>, ...DhiObject<any>[]]>(discriminator: D, options: T) => new DhiDiscriminatedUnion(discriminator, options),
  intersection: <L extends DhiType<any, any>, R extends DhiType<any, any>>(left: L, right: R) => new DhiIntersection(left, right),

  // Recursive & Advanced
  lazy: <T extends DhiType<any, any>>(getter: () => T) => new DhiLazy(getter),
  promise: <T extends DhiType<any, any>>(schema: T) => new DhiPromise(schema),
  // Zod 4: z.function({ input, output }) (Zod 3 `.args()/.returns()` chaining still works)
  function: (params?: { input?: DhiTuple<any> | DhiType<any, any>[]; output?: DhiType<any, any> }) => {
    let fn = new DhiFunction();
    if (params?.input) fn = fn.args(Array.isArray(params.input) ? new DhiTuple(params.input as any) : params.input as DhiTuple<any>) as any;
    if (params?.output) fn = fn.returns(params.output) as any;
    return fn;
  },
  instanceof: <T extends abstract new (...args: any[]) => any>(cls: T) => new DhiInstanceOf(cls),

  // Modifiers
  optional: <T extends DhiType<any, any>>(schema: T) => new DhiOptional(schema),
  nullable: <T extends DhiType<any, any>>(schema: T) => new DhiNullable(schema),

  // Effects
  preprocess: <T extends DhiType<any, any>>(preprocess: (value: unknown) => unknown, schema: T) => new DhiPreprocess(preprocess, schema),
  custom: <T>(check: (value: unknown) => value is T, params?: { message?: string }) => new DhiCustom(check, params),

  // Zod 4: stringbool ("true"/"1"/"yes"/"on"/"y"/"enabled" vs "false"/"0"/"no"/"off"/"n"/"disabled")
  stringbool: (opts?: { truthy?: string[]; falsy?: string[]; case?: 'sensitive' | 'insensitive' }) => new DhiStringBool(opts),

  // Zod 4 top-level object helpers
  looseObject: <T extends Record<string, DhiType<any, any>>>(shape: T) => new DhiObject(shape).loose(),
  strictObject: <T extends Record<string, DhiType<any, any>>>(shape: T) => new DhiObject(shape).strict(),

  // Pipe: chain schemas (validate A then validate/transform B)
  pipe: <A extends DhiType<any, any>, B extends DhiType<any, any>>(a: A, b: B) => new DhiPipe(a, b),

  // Coercion
  coerce: {
    string: () => new DhiCoercedString(),
    number: () => new DhiCoercedNumber(),
    boolean: () => new DhiCoercedBoolean(),
    bigint: () => new DhiCoercedBigInt(),
    date: () => new DhiCoercedDate(),
  },

  // Zod 4: File schema
  file: () => new DhiFile(),

  // Zod 4: Template literal
  templateLiteral: <T extends Array<string | DhiType<any, any>>>(parts: T) => new DhiTemplateLiteral(parts),

  // Zod 4: Top-level string format shortcuts (each accepts Zod's optional message / options)
  email: (message?: ZodMessage) => new DhiString().email(message),
  uuid: (message?: ZodMessage) => new DhiString().uuid(message),
  uuidv4: (message?: ZodMessage) => new DhiString().uuidv4(message),
  uuidv6: (message?: ZodMessage) => new DhiString().uuidv6(message),
  uuidv7: (message?: ZodMessage) => new DhiString().uuidv7(message),
  guid: (message?: ZodMessage) => new DhiString().guid(message),
  url: (opts?: Parameters<DhiString['url']>[0]) => new DhiString().url(opts),
  // Zod 4: http(s) URLs with a real domain name
  httpUrl: (message?: ZodMessage) => new DhiString().url({ message: msgOf(message), protocol: HTTP_PROTOCOL_RE, hostname: DOMAIN_RE }),
  hostname: (message?: ZodMessage) => new DhiString().hostname(message),
  emoji: (message?: ZodMessage) => new DhiString().emoji(message),
  base64: (message?: ZodMessage) => new DhiString().base64(message),
  base64url: (message?: ZodMessage) => new DhiString().base64url(message),
  jwt: (opts?: Parameters<DhiString['jwt']>[0]) => new DhiString().jwt(opts),
  nanoid: (message?: ZodMessage) => new DhiString().nanoid(message),
  cuid: (message?: ZodMessage) => new DhiString().cuid(message),
  cuid2: (message?: ZodMessage) => new DhiString().cuid2(message),
  ulid: (message?: ZodMessage) => new DhiString().ulid(message),
  xid: (message?: ZodMessage) => new DhiString().xid(message),
  ksuid: (message?: ZodMessage) => new DhiString().ksuid(message),
  ipv4: (message?: ZodMessage) => new DhiString().ipv4(message),
  ipv6: (message?: ZodMessage) => new DhiString().ipv6(message),
  ip: (message?: ZodMessage) => new DhiString().ip(message),
  mac: (opts?: Parameters<DhiString['mac']>[0]) => new DhiString().mac(opts),
  cidrv4: (message?: ZodMessage) => new DhiString().cidrv4(message),
  cidrv6: (message?: ZodMessage) => new DhiString().cidrv6(message),
  e164: (message?: ZodMessage) => new DhiString().e164(message),
  hex: (message?: ZodMessage) => new DhiString().hex(message),

  // Zod 4: standalone checks for `.check(...)`, e.g. z.string().check(z.lowercase(), z.minLength(3))
  lowercase: (message?: ZodMessage) => stringFormatCheck('lowercase', LOWERCASE_RE, message),
  uppercase: (message?: ZodMessage) => stringFormatCheck('uppercase', UPPERCASE_RE, message),
  regex: (pattern: RegExp, message?: ZodMessage) => stringFormatCheck('regex', pattern, message),
  includes: (needle: string, opts?: ZodMessage | { message?: string; error?: string; position?: number }) =>
    substringCheck('includes', needle, typeof opts === 'object' && opts !== null ? (opts as { position?: number }).position : undefined, opts),
  startsWith: (prefix: string, message?: ZodMessage) => substringCheck('starts_with', prefix, undefined, message),
  endsWith: (suffix: string, message?: ZodMessage) => substringCheck('ends_with', suffix, undefined, message),
  minLength: (n: number, message?: ZodMessage) => lengthCheck('min_length', n, message),
  maxLength: (n: number, message?: ZodMessage) => lengthCheck('max_length', n, message),
  length: (n: number, message?: ZodMessage) => lengthCheck('length_equals', n, message),
  minSize: (n: number, message?: ZodMessage) => sizeCheck('min_size', n, message),
  maxSize: (n: number, message?: ZodMessage) => sizeCheck('max_size', n, message),
  size: (n: number, message?: ZodMessage) => sizeCheck('size_equals', n, message),
  gt: (value: number | bigint, message?: ZodMessage) => numberCheck('greater_than', value, false, message),
  gte: (value: number | bigint, message?: ZodMessage) => numberCheck('greater_than', value, true, message),
  lt: (value: number | bigint, message?: ZodMessage) => numberCheck('less_than', value, false, message),
  lte: (value: number | bigint, message?: ZodMessage) => numberCheck('less_than', value, true, message),
  positive: (message?: ZodMessage) => numberCheck('greater_than', 0, false, message),
  negative: (message?: ZodMessage) => numberCheck('less_than', 0, false, message),
  nonnegative: (message?: ZodMessage) => numberCheck('greater_than', 0, true, message),
  nonpositive: (message?: ZodMessage) => numberCheck('less_than', 0, true, message),
  multipleOf: (value: number | bigint, message?: ZodMessage) => {
    const msg = msgOf(message);
    return makeCheck({ check: 'multiple_of', value }, payload => {
      const v = payload.value;
      const ok = typeof v === 'bigint' && typeof value === 'bigint' ? v % value === 0n
        : typeof v === 'number' && typeof value === 'number' ? isMultipleOf(v, value) : true;
      if (!ok) pushIssue(payload, { code: 'not_multiple_of', divisor: value, message: msg ?? `Invalid number: must be a multiple of ${value}` });
    });
  },
  trim: () => overwriteCheck((v: string) => v.trim()),
  toLowerCase: () => overwriteCheck((v: string) => v.toLowerCase()),
  toUpperCase: () => overwriteCheck((v: string) => v.toUpperCase()),
  normalize: (form?: string) => overwriteCheck((v: string) => v.normalize(form || 'NFC')),
  overwrite: <T>(tx: (value: T) => T) => overwriteCheck(tx),
  mime: (types: string | string[], message?: ZodMessage) => {
    const list = Array.isArray(types) ? types : [types];
    const msg = msgOf(message);
    return makeCheck({ check: 'mime_type', mime: list }, payload => {
      const t = String(payload.value?.type ?? '').split(';')[0].trim();
      if (!list.includes(t)) pushIssue(payload, { code: 'invalid_value', values: list, message: msg ?? `Invalid file type: expected one of ${list.join(', ')}` });
    });
  },
  property: (key: string, schema: DhiType<any, any>, message?: ZodMessage) => {
    const msg = msgOf(message);
    return makeCheck({ check: 'property', property: key, schema }, payload => {
      const r = schema.safeParse(payload.value?.[key]);
      if (!r.success) for (const iss of r.error.issues) payload.issues.push({ ...iss, message: msg ?? iss.message, path: [key, ...iss.path] });
    });
  },
  refine: <T>(fn: (value: T) => boolean, message?: ZodMessage | { message?: string; error?: string; path?: (string | number)[] }) => {
    const msg = msgOf(message);
    const path = typeof message === 'object' && message !== null ? (message as any).path : undefined;
    return makeCheck({ check: 'custom', fn }, payload => {
      if (!fn(payload.value)) pushIssue(payload, { code: 'custom', message: msg ?? 'Invalid input', ...(path ? { path } : {}) });
    });
  },
  superRefine: <T>(fn: (value: T, ctx: { addIssue: (issue: Partial<ZodIssue>) => void }) => void) =>
    makeCheck({ check: 'custom', fn }, payload => fn(payload.value, {
      addIssue: issue => pushIssue(payload, { code: 'custom', message: 'Invalid input', ...issue }),
    })),
  check: (fn: (payload: ZodParsePayload) => void) => makeCheck({ check: 'custom', fn }, fn),

  // Zod 4: Hash validation (hex by default; `enc: 'base64' | 'base64url'` supported)
  hash: (algorithm: 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512', opts?: Parameters<DhiString['hash']>[1]) =>
    new DhiString().hash(algorithm, opts),

  // Zod 4: iso namespace for date/time formats
  iso: {
    datetime: (opts?: Parameters<DhiString['datetime']>[0]) => new DhiString().datetime(opts),
    date: (message?: ZodMessage) => new DhiString().date(message),
    time: (opts?: Parameters<DhiString['time']>[0]) => new DhiString().time(opts),
    duration: (message?: ZodMessage) => new DhiString().duration(message),
  },

  // Zod 4: Number format shortcuts
  int: () => new DhiNumber().int().safe(),
  float: () => new DhiNumber().finite(),
  float32: () => new DhiNumber().finite().min(-3.4028235e38).max(3.4028235e38),
  float64: () => new DhiNumber().finite(),
  int8: () => new DhiNumber().int().min(-128).max(127),
  uint8: () => new DhiNumber().int().min(0).max(255),
  int16: () => new DhiNumber().int().min(-32768).max(32767),
  uint16: () => new DhiNumber().int().min(0).max(65535),
  int32: () => new DhiNumber().int().min(-2147483648).max(2147483647),
  uint32: () => new DhiNumber().int().min(0).max(4294967295),
  int64: () => new DhiBigInt().min(-9223372036854775808n).max(9223372036854775807n),
  uint64: () => new DhiBigInt().min(0n).max(18446744073709551615n),

  // Zod 4: json() - recursive JSON schema
  json: (): DhiType<any, any> => new DhiLazy(() => new DhiUnion([
    new DhiString(),
    new DhiNumber(),
    new DhiBoolean(),
    new DhiNull(),
    new DhiArray(z.json()),
    new DhiRecord(new DhiString(), z.json()),
  ])),

  // Zod 4: success wrapper
  success: <T extends DhiType<any, any>>(schema: T) => new DhiSuccess(schema),

  // Zod 4: Registry system
  registry: <M extends Record<string, any> = GlobalMeta>() => new DhiRegistry<M>(),
  globalRegistry,

  // Zod 4: prettifyError - format error for display
  prettifyError: (error: ZodError): string => {
    const lines: string[] = [];
    for (const issue of error.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      lines.push(`• ${path}: ${issue.message}`);
    }
    return lines.join('\n');
  },

  // Type utilities (these are type-level only, no runtime impact)
  infer: undefined as any,
  input: undefined as any,
  output: undefined as any,

  // Error class
  ZodError,

  // Zod 4: Top-level JSON Schema generation (alias for schema.toJsonSchema())
  // Usage: z.toJSONSchema(schema) or z.toJSONSchema(schema, { target: 'draft-07' })
  toJSONSchema: <T extends DhiType<any, any>>(
    schema: T,
    params?: {
      target?: 'draft-2020-12' | 'draft-07' | 'draft-04' | 'openapi-3.0';
      // Additional params for future compatibility
      unrepresentable?: 'throw' | 'any';
      io?: 'input' | 'output';
    }
  ): Record<string, any> => {
    // draft-2020-12 style output; `io` selects input vs output semantics like Zod.
    // `target` / `unrepresentable` are accepted for API compatibility.
    return schema.toJsonSchema({ io: params?.io });
  },

  // Issue #55: JSON Schema import — hydrate a dhi schema from a JSON Schema doc
  // (the inverse of toJSONSchema, for define-once cross-language schema sharing).
  fromJsonSchema,
} as const;

// Type-level utilities
export namespace z {
  export type infer<T extends DhiType<any, any>> = T["_output"];
  export type input<T extends DhiType<any, any>> = T["_input"];
  export type output<T extends DhiType<any, any>> = T["_output"];
  export type ZodType<Output = any, Input = Output> = DhiType<Output, Input>;
}

// Also export as `d` for dhi-native usage
export const d = z;
export namespace d {
  export type infer<T extends DhiType<any, any>> = T["_output"];
  export type input<T extends DhiType<any, any>> = T["_input"];
  export type output<T extends DhiType<any, any>> = T["_output"];
}

// Re-export types for compatibility
export type { DhiType as ZodType };
export type { DhiString as ZodString };
export type { DhiNumber as ZodNumber };
export type { DhiBigInt as ZodBigInt };
export type { DhiBoolean as ZodBoolean };
export type { DhiDate as ZodDate };
export type { DhiUndefined as ZodUndefined };
export type { DhiNull as ZodNull };
export type { DhiVoid as ZodVoid };
export type { DhiNever as ZodNever };
export type { DhiAny as ZodAny };
export type { DhiUnknown as ZodUnknown };
export type { DhiArray as ZodArray };
export type { DhiObject as ZodObject };
export type { DhiUnion as ZodUnion };
export type { DhiDiscriminatedUnion as ZodDiscriminatedUnion };
export type { DhiIntersection as ZodIntersection };
export type { DhiTuple as ZodTuple };
export type { DhiRecord as ZodRecord };
export type { DhiMap as ZodMap };
export type { DhiSet as ZodSet };
export type { DhiLazy as ZodLazy };
export type { DhiLiteral as ZodLiteral };
export type { DhiEnum as ZodEnum };
export type { DhiNativeEnum as ZodNativeEnum };
export type { DhiOptional as ZodOptional };
export type { DhiNullable as ZodNullable };
export type { DhiDefault as ZodDefault };
export type { DhiTransform as ZodEffects };
export type { DhiRefine as ZodRefine };
export type { DhiPipe as ZodPipeline };
export type { DhiPromise as ZodPromise };
export type { DhiFunction as ZodFunction };
export type { DhiFile as ZodFile };
export type { DhiTemplateLiteral as ZodTemplateLiteral };
export type { DhiSuccess as ZodSuccess };
export type { DhiRegistry as ZodRegistry };
export type { DhiStringBool as ZodStringBool };
export type { DhiCustom as ZodCustom };
export type { DhiInstanceOf as ZodInstanceOf };
export type { DhiPreprocess as ZodPreprocess };
export type { DhiReadonly as ZodReadonly };
export type { DhiNaN as ZodNaN };
export type { DhiSymbol as ZodSymbol };

// ============================================================================
// Zod 4 core compatibility (`schema._zod`)
// ============================================================================
// Zod 4 keeps its internals on `schema._zod`, and ecosystem libraries use that
// property to detect a Zod 4 schema and then call Zod's own core helpers on
// it. The MCP SDK, for example, does:
//   isZ4Schema(s)        -> !!s._zod
//   safeParse(s, data)   -> s._zod.run({ value, issues: [] }, ctx)
//   toJSONSchema(s)      -> s._zod.toJSONSchema?.() ?? walk s._zod.def
//   getObjectShape(s)    -> s._zod.def.shape
//   isSchemaOptional(s)  -> s._zod.def.type === 'optional'
// dhi implements exactly that surface, so every dhi schema satisfies Zod's
// `$ZodType` interface at the type level (`z.output<S>` resolves to dhi's
// inferred output) and behaves like one at runtime.

export type ZodTypeKind =
  | 'string' | 'number' | 'int' | 'boolean' | 'bigint' | 'symbol' | 'null' | 'undefined' | 'void' | 'never'
  | 'any' | 'unknown' | 'date' | 'object' | 'record' | 'file' | 'array' | 'tuple' | 'union' | 'intersection'
  | 'map' | 'set' | 'enum' | 'literal' | 'nullable' | 'optional' | 'nonoptional' | 'success' | 'transform'
  | 'default' | 'prefault' | 'catch' | 'nan' | 'pipe' | 'readonly' | 'template_literal' | 'promise' | 'lazy'
  | 'function' | 'custom';

/** Zod 4-style schema definition (`schema._zod.def`, also exposed as `schema.def` / `schema._def`) */
export interface ZodCompatDef {
  type: ZodTypeKind;
  /** Zod 3-style class name, e.g. "ZodObject" (kept for legacy consumers) */
  typeName: string;
  description?: string;
  checks?: any[];
  error?: undefined;
  [key: string]: any;
}

export interface ZodParsePayload {
  value: any;
  issues: any[];
  aborted?: boolean;
}

/** Structural mirror of Zod 4's `$ZodTypeInternals` (what `schema._zod` holds) */
export interface ZodCompatInternals<Output = unknown, Input = unknown> {
  version: { readonly major: 4; readonly minor: any; readonly patch: number };
  def: ZodCompatDef;
  id: string;
  /** Type-level only */
  output: Output;
  /** Type-level only */
  input: Input;
  optin?: 'optional' | undefined;
  optout?: 'optional' | undefined;
  values?: Set<any> | undefined;
  propValues?: Record<string, Set<any>> | undefined;
  pattern: RegExp | undefined;
  constr: new (def: any) => any;
  traits: Set<string>;
  bag: Record<string, unknown>;
  /** Type-level only (never assigned at runtime) */
  isst: never;
  deferred: Array<(...args: any[]) => any> | undefined;
  parent?: undefined;
  run(payload: ZodParsePayload, ctx?: any): ZodParsePayload;
  parse(payload: ZodParsePayload, ctx?: any): ZodParsePayload;
  toJSONSchema?: undefined;
  processJSONSchema: (ctx: any, json: Record<string, any>, params?: any) => void;
}

const ZOD_COMPAT_VERSION = Object.freeze({ major: 4, minor: 3, patch: 0 }) as { readonly major: 4; readonly minor: any; readonly patch: number };
let zodCompatIdCounter = 0;

// dhi (Zod 3-style) issue codes → Zod 4 issue codes
const ZOD4_ISSUE_CODES: Record<string, string> = {
  invalid_string: 'invalid_format',
  invalid_enum_value: 'invalid_value',
  invalid_literal: 'invalid_value',
  invalid_union_discriminator: 'invalid_union',
  invalid_date: 'invalid_type',
  invalid_arguments: 'custom',
  invalid_return_type: 'custom',
  invalid_intersection_types: 'custom',
  not_finite: 'invalid_type',
};

// Zod 4 class name per def.type
const ZOD_CLASS_BY_KIND: Record<string, string> = {
  string: 'ZodString', number: 'ZodNumber', int: 'ZodNumber', boolean: 'ZodBoolean', bigint: 'ZodBigInt',
  symbol: 'ZodSymbol', null: 'ZodNull', undefined: 'ZodUndefined', void: 'ZodVoid', never: 'ZodNever',
  any: 'ZodAny', unknown: 'ZodUnknown', date: 'ZodDate', object: 'ZodObject', record: 'ZodRecord',
  file: 'ZodFile', array: 'ZodArray', tuple: 'ZodTuple', union: 'ZodUnion', intersection: 'ZodIntersection',
  map: 'ZodMap', set: 'ZodSet', enum: 'ZodEnum', literal: 'ZodLiteral', nullable: 'ZodNullable',
  optional: 'ZodOptional', nonoptional: 'ZodNonOptional', success: 'ZodSuccess', transform: 'ZodTransform',
  default: 'ZodDefault', prefault: 'ZodPrefault', catch: 'ZodCatch', nan: 'ZodNaN', pipe: 'ZodPipe',
  readonly: 'ZodReadonly', template_literal: 'ZodTemplateLiteral', promise: 'ZodPromise', lazy: 'ZodLazy',
  function: 'ZodFunction', custom: 'ZodCustom',
};

// Internal node standing in for Zod's `$ZodTransform` inside `pipe` defs
class DhiTransformNode extends DhiType<any, any> {
  constructor(private _fn: (value: any) => any) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<any> {
    try {
      return { success: true, data: this._fn(value) };
    } catch (e: any) {
      return { success: false, error: new ZodError([{ code: 'custom', path, message: e?.message ?? 'Transform failed' }]) };
    }
  }
}

function toZod4Issue(issue: ZodIssue, input: unknown): any {
  return { ...issue, code: ZOD4_ISSUE_CODES[issue.code] ?? issue.code, input };
}

// `_zod.run` / `_zod.parse`: validate through dhi and report in Zod's payload shape
function zodRun(schema: DhiType<any, any>, payload: ZodParsePayload): ZodParsePayload {
  const result = schema.safeParse(payload.value);
  if (result.success) {
    payload.value = result.data;
  } else {
    const issues = result.error.issues;
    for (let i = 0; i < issues.length; i++) payload.issues.push(toZod4Issue(issues[i], payload.value));
  }
  return payload;
}

function defineLazy(obj: any, key: string, getter: () => any): void {
  Object.defineProperty(obj, key, {
    get() {
      const value = getter();
      Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
      return value;
    },
    enumerable: true,
    configurable: true,
  });
}

const _zodLazyVisiting = new WeakSet<object>();
function resolveLazy<T>(schema: DhiLazy<any>, fn: (inner: DhiType<any, any>) => T, fallback: T): T {
  if (_zodLazyVisiting.has(schema)) return fallback;
  _zodLazyVisiting.add(schema);
  try {
    return fn((schema as any).getter());
  } catch {
    return fallback;
  } finally {
    _zodLazyVisiting.delete(schema);
  }
}

// Zod's optin/optout: whether a key holding this schema may be absent (input side / output side)
function zodOptionality(s: DhiType<any, any>, dir: 'in' | 'out'): 'optional' | undefined {
  const a = s as any;
  if (s instanceof DhiOptional || s instanceof DhiExactOptional) return 'optional';
  if (s instanceof DhiUndefined || s instanceof DhiVoid) return 'optional';
  if (s instanceof DhiNonOptional) return undefined;
  if (s instanceof DhiDefault) return dir === 'in' ? 'optional' : undefined;
  if (s instanceof DhiCatch) return zodOptionality(a._inner, dir); // Zod: catch inherits the inner optionality
  if (s instanceof DhiNullable || s instanceof DhiReadonly || s instanceof DhiRefine ||
      s instanceof DhiSuperRefine || s instanceof DhiCheck || s instanceof DhiSuccess) return zodOptionality(a._inner, dir);
  if (s instanceof DhiPipe) return dir === 'in' ? zodOptionality(a._a, 'in') : zodOptionality(a._b, 'out');
  if (s instanceof DhiTransform) return dir === 'in' ? zodOptionality(a._inner, 'in') : undefined;
  if (s instanceof DhiPreprocess) return dir === 'out' ? zodOptionality(a._schema, 'out') : undefined;
  if (s instanceof DhiUnion) {
    return (a.options as DhiType<any, any>[]).some(o => zodOptionality(o, dir) === 'optional') ? 'optional' : undefined;
  }
  if (s instanceof DhiLazy) return resolveLazy(s, inner => zodOptionality(inner, dir), undefined);
  return undefined;
}

// Zod's `values`: the exhaustive literal set this schema accepts (literal/enum/null/undefined)
function zodValues(s: DhiType<any, any>): Set<any> | undefined {
  const a = s as any;
  if (s instanceof DhiLiteral) return new Set(a._values);
  if (s instanceof DhiEnum) return new Set(s.options);
  if (s instanceof DhiNativeEnum) return new Set(a._values);
  if (s instanceof DhiNull) return new Set([null]);
  if (s instanceof DhiUndefined) return new Set([undefined]);
  if (s instanceof DhiOptional) { const v = zodValues(a._inner); return v ? new Set([...v, undefined]) : undefined; }
  if (s instanceof DhiNullable) { const v = zodValues(a._inner); return v ? new Set([...v, null]) : undefined; }
  if (s instanceof DhiDefault || s instanceof DhiCatch || s instanceof DhiReadonly || s instanceof DhiExactOptional ||
      s instanceof DhiRefine || s instanceof DhiSuperRefine || s instanceof DhiCheck) return zodValues(a._inner);
  if (s instanceof DhiNonOptional) { const v = zodValues(a._inner); if (!v) return undefined; const out = new Set(v); out.delete(undefined); return out; }
  if (s instanceof DhiPipe) return zodValues(a._a);
  if (s instanceof DhiLazy) return resolveLazy(s, zodValues, undefined);
  return undefined;
}

// Zod's `propValues`: per-key literal sets of an object (discriminated-union fast path)
function zodPropValues(s: DhiType<any, any>): Record<string, Set<any>> | undefined {
  if (s instanceof DhiObject) {
    const out: Record<string, Set<any>> = {};
    for (const key of Object.keys(s.shape)) {
      const v = s.shape[key]._zod.values;
      if (v) out[key] = v;
    }
    return out;
  }
  if (s instanceof DhiUnion || s instanceof DhiDiscriminatedUnion) {
    const out: Record<string, Set<any>> = {};
    for (const opt of (s as any).options as DhiType<any, any>[]) {
      const pv = opt._zod.propValues;
      if (!pv) continue;
      for (const key in pv) {
        (out[key] ??= new Set()).forEach; // ensure key
        for (const v of pv[key]) out[key].add(v);
      }
    }
    return out;
  }
  return undefined;
}

// Zod's `pattern`: regex form of the schema (template literal building block)
function zodPattern(s: DhiType<any, any>): RegExp | undefined {
  const a = s as any;
  if (s instanceof DhiTemplateLiteral) return a._regex;
  if (s instanceof DhiString) return /^[\s\S]*$/;
  if (s instanceof DhiNumber) return /^-?\d+(?:\.\d+)?$/;
  if (s instanceof DhiBigInt) return /^-?\d+n?$/;
  if (s instanceof DhiBoolean) return /^(?:true|false)$/i;
  if (s instanceof DhiNull) return /^null$/i;
  if (s instanceof DhiUndefined) return /^undefined$/i;
  if (s instanceof DhiLiteral) return new RegExp(`^(${(a._values as any[]).map(v => escapeRegex(String(v))).join('|')})$`);
  if (s instanceof DhiEnum) return new RegExp(`^(${(s.options as readonly string[]).map(v => escapeRegex(v)).join('|')})$`);
  if (s instanceof DhiOptional || s instanceof DhiNullable || s instanceof DhiDefault ||
      s instanceof DhiReadonly || s instanceof DhiRefine || s instanceof DhiSuperRefine || s instanceof DhiCheck) return zodPattern(a._inner);
  return undefined;
}

// Zod's `bag`: metadata accumulated from checks (min/max/format/patterns)
function zodBag(s: DhiType<any, any>): Record<string, unknown> {
  const bag: Record<string, unknown> = {};
  const checks = (s as any).checks as Array<{ type: string; value?: any }> | undefined;
  if (!checks) return bag;
  const setMin = (v: number) => { if (bag.minimum === undefined || v > (bag.minimum as number)) bag.minimum = v; };
  const setMax = (v: number) => { if (bag.maximum === undefined || v < (bag.maximum as number)) bag.maximum = v; };
  if (s instanceof DhiString) {
    for (const c of checks) {
      switch (c.type) {
        case 'min': setMin(c.value); break;
        case 'max': setMax(c.value); break;
        case 'length': setMin(c.value); setMax(c.value); break;
        case 'nonempty': setMin(1); break;
        case 'regex': ((bag.patterns ??= new Set()) as Set<RegExp>).add(c.value); break;
        default: if (bag.format === undefined && ZOD_FORMAT_NAMES[c.type]) bag.format = ZOD_FORMAT_NAMES[c.type];
      }
    }
  } else if (s instanceof DhiNumber || s instanceof DhiBigInt) {
    for (const c of checks) {
      switch (c.type) {
        case 'min': case 'gte': setMin(c.value); break;
        case 'max': case 'lte': setMax(c.value); break;
        case 'gt': bag.exclusiveMinimum = c.value; break;
        case 'lt': bag.exclusiveMaximum = c.value; break;
        case 'positive': bag.exclusiveMinimum = 0; break;
        case 'negative': bag.exclusiveMaximum = 0; break;
        case 'nonnegative': setMin(0); break;
        case 'nonpositive': setMax(0); break;
        case 'int': case 'safe': bag.format = 'safeint'; setMin(Number.MIN_SAFE_INTEGER); setMax(Number.MAX_SAFE_INTEGER); break;
        case 'multipleOf': case 'step': bag.multipleOf = c.value; break;
      }
    }
  } else if (s instanceof DhiArray) {
    for (const c of checks) {
      switch (c.type) {
        case 'min': setMin(c.value); break;
        case 'max': setMax(c.value); break;
        case 'length': setMin(c.value); setMax(c.value); break;
        case 'nonempty': setMin(1); break;
      }
    }
  }
  return bag;
}

function zodArrayChecks(checks: Array<{ type: string; value?: any; message?: string }>): any[] {
  const out: any[] = [];
  for (const c of checks) {
    switch (c.type) {
      case 'min': out.push(zodCheck('min_length', { minimum: c.value }, c.message)); break;
      case 'max': out.push(zodCheck('max_length', { maximum: c.value }, c.message)); break;
      case 'length': out.push(zodCheck('length_equals', { length: c.value }, c.message)); break;
      case 'nonempty': out.push(zodCheck('min_length', { minimum: 1 }, c.message)); break;
    }
  }
  return out;
}

// The Zod 4 `def` for a dhi schema (same field names Zod uses for each kind)
function buildZodDefCore(s: DhiType<any, any>): Record<string, any> {
  const a = s as any;
  if (s instanceof DhiString) {
    const d: Record<string, any> = { type: 'string', checks: s._zodChecks() };
    if (s instanceof DhiCoercedString) d.coerce = true;
    const format = s._zodFormat();
    if (format !== undefined) d.format = format;
    return d;
  }
  if (s instanceof DhiNumber) {
    const d: Record<string, any> = { type: 'number', checks: s._zodChecks() };
    if (s instanceof DhiCoercedNumber) d.coerce = true;
    if ((a.checks as Array<{ type: string }>).some(c => c.type === 'int' || c.type === 'safe')) d.format = 'safeint';
    return d;
  }
  if (s instanceof DhiBigInt) return { type: 'bigint', checks: [], ...(s instanceof DhiCoercedBigInt ? { coerce: true } : {}) };
  if (s instanceof DhiBoolean) return { type: 'boolean', ...(s instanceof DhiCoercedBoolean ? { coerce: true } : {}) };
  if (s instanceof DhiDate) return { type: 'date', checks: [], ...(s instanceof DhiCoercedDate ? { coerce: true } : {}) };
  if (s instanceof DhiNaN) return { type: 'nan' };
  if (s instanceof DhiSymbol) return { type: 'symbol' };
  if (s instanceof DhiUndefined) return { type: 'undefined' };
  if (s instanceof DhiNull) return { type: 'null' };
  if (s instanceof DhiVoid) return { type: 'void' };
  if (s instanceof DhiNever) return { type: 'never' };
  if (s instanceof DhiAny) return { type: 'any' };
  if (s instanceof DhiUnknown) return { type: 'unknown' };
  if (s instanceof DhiLiteral) return { type: 'literal', values: [...a._values] };
  if (s instanceof DhiEnum) {
    const entries: Record<string, string> = {};
    for (const v of s.options) entries[v] = v;
    return { type: 'enum', entries };
  }
  if (s instanceof DhiNativeEnum) return { type: 'enum', entries: a.enumObj };
  if (s instanceof DhiObject) {
    const d: Record<string, any> = { type: 'object', shape: s.shape };
    if (a._catchall) d.catchall = a._catchall;
    else if (a._unknownKeys === 'strict') d.catchall = new DhiNever();
    else if (a._unknownKeys === 'passthrough') d.catchall = new DhiUnknown();
    return d;
  }
  if (s instanceof DhiArray) return { type: 'array', element: a.element, checks: zodArrayChecks(a.checks) };
  if (s instanceof DhiTuple) return { type: 'tuple', items: a.items, rest: a._rest ?? null };
  if (s instanceof DhiRecord) return { type: 'record', keyType: a.keySchema, valueType: a.valueSchema };
  if (s instanceof DhiMap) return { type: 'map', keyType: a.keySchema, valueType: a.valueSchema };
  if (s instanceof DhiSet) return { type: 'set', valueType: a.valueSchema };
  if (s instanceof DhiDiscriminatedUnion) return { type: 'union', options: a.options, discriminator: a.discriminator };
  if (s instanceof DhiUnion) return { type: 'union', options: a.options };
  if (s instanceof DhiIntersection) return { type: 'intersection', left: a.left, right: a.right };
  if (s instanceof DhiLazy) return { type: 'lazy', getter: a.getter };
  if (s instanceof DhiPromise) return { type: 'promise', innerType: a.schema };
  if (s instanceof DhiFunction) return { type: 'function', input: a._args, output: a._returns };
  if (s instanceof DhiInstanceOf) { const cls = a.cls; return { type: 'custom', fn: (v: unknown) => v instanceof cls }; }
  if (s instanceof DhiOptional || s instanceof DhiExactOptional) return { type: 'optional', innerType: a._inner };
  if (s instanceof DhiNonOptional) return { type: 'nonoptional', innerType: a._inner };
  if (s instanceof DhiNullable) return { type: 'nullable', innerType: a._inner };
  if (s instanceof DhiDefault) {
    const d: Record<string, any> = { type: 'default', innerType: a._inner };
    Object.defineProperty(d, 'defaultValue', {
      get: () => (typeof a._default === 'function' ? a._default() : a._default),
      enumerable: true,
      configurable: true,
    });
    return d;
  }
  if (s instanceof DhiCatch) return { type: 'catch', innerType: a._inner, catchValue: () => (typeof a._catch === 'function' ? a._catch() : a._catch) };
  if (s instanceof DhiTransform) return { type: 'pipe', in: a._inner, out: new DhiTransformNode(a._transform) };
  if (s instanceof DhiRefine) {
    const inner = (a._inner as DhiType<any, any>)._zod.def;
    return { ...inner, checks: [...(inner.checks ?? []), zodCheck('custom', { fn: a._check, path: a._path }, a._message)] };
  }
  if (s instanceof DhiSuperRefine) {
    const inner = (a._inner as DhiType<any, any>)._zod.def;
    return { ...inner, checks: [...(inner.checks ?? []), zodCheck('custom', { fn: a._refinement })] };
  }
  if (s instanceof DhiCheck) {
    const inner = (a._inner as DhiType<any, any>)._zod.def;
    return { ...inner, checks: [...(inner.checks ?? []), ...s._zodChecks()] };
  }
  if (s instanceof DhiPipe) return { type: 'pipe', in: a._a, out: a._b };
  if (s instanceof DhiReadonly) return { type: 'readonly', innerType: a._inner };
  if (s instanceof DhiPreprocess) return { type: 'pipe', in: new DhiTransformNode(a._preprocess), out: a._schema };
  if (s instanceof DhiFile) return { type: 'file', checks: [] };
  if (s instanceof DhiTemplateLiteral) return { type: 'template_literal', parts: a._parts };
  if (s instanceof DhiStringBool) return { type: 'pipe', in: new DhiString(), out: new DhiBoolean() };
  if (s instanceof DhiCustom) return { type: 'custom', fn: a._checkFn };
  if (s instanceof DhiSuccess) return { type: 'success', innerType: a._inner };
  if (s instanceof DhiTransformNode) return { type: 'transform', transform: a._fn };
  return { type: 'custom' };
}

function buildZodDef(s: DhiType<any, any>): ZodCompatDef {
  const def = buildZodDefCore(s) as ZodCompatDef;
  def.typeName = s instanceof DhiDiscriminatedUnion ? 'ZodDiscriminatedUnion' : (ZOD_CLASS_BY_KIND[def.type] ?? 'ZodType');
  if (s._description !== undefined) def.description = s._description;
  return def;
}

function buildZodInternals(schema: DhiType<any, any>): ZodCompatInternals<any, any> {
  const def = buildZodDef(schema);
  const traits = new Set<string>(['$ZodType', 'ZodType', def.typeName, '$' + def.typeName]);
  if (schema instanceof DhiDiscriminatedUnion) { traits.add('ZodUnion'); traits.add('$ZodUnion'); }
  const internals: any = {
    version: ZOD_COMPAT_VERSION,
    def,
    id: `dhi_${++zodCompatIdCounter}`,
    output: undefined,
    input: undefined,
    pattern: zodPattern(schema),
    constr: schema.constructor,
    traits,
    bag: zodBag(schema),
    deferred: [],
    run: (payload: ZodParsePayload) => zodRun(schema, payload),
    parse: (payload: ZodParsePayload) => zodRun(schema, payload),
    // Zod's generator calls this with its context, so `io: 'input' | 'output'` is honoured
    processJSONSchema: (ctx: { io?: 'input' | 'output' } | undefined, json: Record<string, any>) => {
      Object.assign(json, schema.toJsonSchema({ io: ctx?.io === 'input' ? 'input' : 'output' }));
    },
  };
  // These depend on wrapped schemas (and lazy getters), so resolve on demand
  defineLazy(internals, 'optin', () => zodOptionality(schema, 'in'));
  defineLazy(internals, 'optout', () => zodOptionality(schema, 'out'));
  defineLazy(internals, 'values', () => zodValues(schema));
  defineLazy(internals, 'propValues', () => zodPropValues(schema));
  return internals as ZodCompatInternals<any, any>;
}

// Default export
export default z;
