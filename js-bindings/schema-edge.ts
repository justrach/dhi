/**
 * dhi - Ultra-fast Zod 4 compatible schema validation with SIMD-powered WASM backend
 * Edge Runtime compatible version (Vercel Edge, Deno, etc.) - uses direct WASM import pattern
 *
 * Usage:
 *   import { z } from 'dhi/edge';
 *   const schema = z.object({ name: z.string(), age: z.number() });
 *   type User = z.infer<typeof schema>;
 */

// @ts-ignore - Edge runtimes support direct WASM imports
import wasmModule from './dhi.wasm';

// ============================================================================
// WASM Backend Loading (Edge Runtime compatible)
// ============================================================================

// Edge runtimes pre-compile WASM imports at build time
// We use top-level await which is supported in Workers
// Note: When instantiating a pre-compiled module, WebAssembly.instantiate returns Instance directly
const wasmResult = await WebAssembly.instantiate(wasmModule, {});
// Handle both cases: compiled module returns Instance, bytes return { instance, module }
const wasm = ('exports' in wasmResult ? wasmResult.exports : wasmResult.instance.exports) as any;
const encoder = new TextEncoder();

function wasmValidateString(fn: string, value: string): boolean {
  const bytes = encoder.encode(value);
  const ptr = wasm.alloc(bytes.length);
  if (!ptr) return false;
  new Uint8Array(wasm.memory.buffer).set(bytes, ptr);
  const result = wasm[fn](ptr, bytes.length);
  wasm.dealloc(ptr, bytes.length);
  return result;
}

// --------------------------------------------------------------------------
// Fast pure-JS validators (avoid WASM FFI for short-string ops)
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

// Pre-computed lookup for email local-part chars
const EMAIL_LOCAL = new Uint8Array(128);
for (let i = 65; i <= 90; i++) EMAIL_LOCAL[i] = 1;  // A-Z
for (let i = 97; i <= 122; i++) EMAIL_LOCAL[i] = 1; // a-z
for (let i = 48; i <= 57; i++) EMAIL_LOCAL[i] = 1;  // 0-9
EMAIL_LOCAL[46] = 1; EMAIL_LOCAL[95] = 1; EMAIL_LOCAL[37] = 1; // . _ %
EMAIL_LOCAL[43] = 1; EMAIL_LOCAL[45] = 1; // + -

// Pre-computed lookup for email domain chars
const EMAIL_DOMAIN = new Uint8Array(128);
for (let i = 65; i <= 90; i++) EMAIL_DOMAIN[i] = 1;  // A-Z
for (let i = 97; i <= 122; i++) EMAIL_DOMAIN[i] = 1; // a-z
for (let i = 48; i <= 57; i++) EMAIL_DOMAIN[i] = 1;  // 0-9
EMAIL_DOMAIN[46] = 1; EMAIL_DOMAIN[45] = 1; // . -

// UUID regex compiled once → V8 Irregexp JITs this to native code
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function fastValidateUuid(s: string): boolean {
  return s.length === 36 && UUID_RE.test(s);
}

function fastValidateBase64(s: string): boolean {
  if (s.length === 0) return false;
  const len = s.length;
  if (len % 4 !== 0) {
    // Allow unpadded: just validate chars
    for (let i = 0; i < len; i++) {
      const c = s.charCodeAt(i);
      if (c > 127 || !B64_CHARS[c]) return false;
    }
    return true;
  }
  // Padded: check chars then padding
  let padStart = len;
  if (s.charCodeAt(len - 1) === 61) padStart = len - (s.charCodeAt(len - 2) === 61 ? 2 : 1);
  for (let i = 0; i < padStart; i++) {
    const c = s.charCodeAt(i);
    if (c > 127 || !B64_CHARS[c]) return false;
  }
  return true;
}

function fastValidateDate(s: string): boolean {
  if (s.length !== 10) return false;
  if (s.charCodeAt(4) !== 45 || s.charCodeAt(7) !== 45) return false;
  // Check all digit positions
  for (const i of [0,1,2,3,5,6,8,9]) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  const month = (s.charCodeAt(5) - 48) * 10 + (s.charCodeAt(6) - 48);
  const day = (s.charCodeAt(8) - 48) * 10 + (s.charCodeAt(9) - 48);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function fastValidateEmail(s: string): boolean {
  if (s.length < 3 || s.length > 320) return false;
  const atIdx = s.indexOf('@');
  if (atIdx < 1 || atIdx > s.length - 3) return false;
  // Validate local part
  for (let i = 0; i < atIdx; i++) {
    const c = s.charCodeAt(i);
    if (c > 127 || !EMAIL_LOCAL[c]) return false;
  }
  // Validate domain part
  const domain = s.substring(atIdx + 1);
  if (domain.indexOf('.') === -1) return false;
  if (domain.charCodeAt(0) === 45 || domain.charCodeAt(domain.length - 1) === 45) return false;
  for (let i = 0; i < domain.length; i++) {
    const c = domain.charCodeAt(i);
    if (c > 127 || !EMAIL_DOMAIN[c]) return false;
  }
  return true;
}

// Shared empty path for optimistic (no-error) parsing - avoids allocation
const EMPTY_PATH: (string | number)[] = [];

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

/** Make optional keys actually optional in the type */
type OptionalKeys<T extends Record<string, DhiType<any, any>>> = {
  [K in keyof T]: undefined extends T[K]["_output"] ? K : never;
}[keyof T];

type RequiredKeys<T extends Record<string, DhiType<any, any>>> = Exclude<keyof T, OptionalKeys<T>>;

type InferObjectOutput<T extends Record<string, DhiType<any, any>>> =
  { [K in RequiredKeys<T> & string]: T[K]["_output"] } &
  { [K in OptionalKeys<T> & string]?: T[K]["_output"] };

type InferObjectInput<T extends Record<string, DhiType<any, any>>> =
  { [K in RequiredKeys<T> & string]: T[K]["_input"] } &
  { [K in OptionalKeys<T> & string]?: T[K]["_input"] };

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
  | "not_finite";

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

export abstract class DhiType<Output = any, Input = Output> {
  readonly _output!: Output;
  readonly _input!: Input;
  _description?: string;
  _metadata?: Record<string, any>;

  abstract _parse(value: unknown, path: (string | number)[]): SafeParseResult<Output>;

  parse(value: unknown): Output {
    const result = this._parse(value, []);
    if (!result.success) throw result.error;
    return result.data;
  }

  safeParse(value: unknown): SafeParseResult<Output> {
    return this._parse(value, []);
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

  isOptional(): boolean {
    return false;
  }

  isNullable(): boolean {
    return false;
  }

  // Zod 4: nonoptional - removes optionality
  nonoptional(): DhiType<Exclude<Output, undefined>, Exclude<Input, undefined>> {
    return this as any;
  }

  // Zod 4: exactOptional - optional without affecting defaults
  exactOptional(): DhiOptional<this> {
    return new DhiOptional(this);
  }

  // Zod 4: check - new name for superRefine
  check(refinement: (value: Output, ctx: { addIssue: (issue: Partial<ZodIssue>) => void }) => void): DhiSuperRefine<this> {
    return new DhiSuperRefine(this, refinement);
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

  // JSON Schema generation - override in subclasses
  toJsonSchema(): Record<string, any> {
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

  // Override in subclasses to provide type-specific schema
  protected _toJsonSchemaCore(): Record<string, any> {
    return {};
  }
}

// ============================================================================
// Primitive Schemas
// ============================================================================

export class DhiString extends DhiType<string, string> {
  private checks: Array<{ type: string; value?: any; message?: string }> = [];

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
            return { success: false, error: new ZodError([{ code: 'too_small', path, message: check.message || `String must contain exactly ${check.value} character(s)` }]) };
          break;
        case 'email':
          if (!fastValidateEmail(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid email' }]) };
          break;
        case 'url':
          if (!wasmValidateString('validate_url_simd', current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid url' }]) };
          break;
        case 'uuid':
          if (!fastValidateUuid(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid uuid' }]) };
          break;
        case 'cuid':
          if (!/^c[^\s-]{8,}$/i.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid cuid' }]) };
          break;
        case 'cuid2':
          if (!/^[0-9a-z]+$/.test(current) || current.length === 0)
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid cuid2' }]) };
          break;
        case 'ulid':
          if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid ulid' }]) };
          break;
        case 'emoji':
          if (!/\p{Emoji}/u.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid emoji' }]) };
          break;
        case 'ipv4':
          if (!wasmValidateString('validate_ipv4_simd', current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid IPv4 address' }]) };
          break;
        case 'ipv6':
          if (!/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(current) &&
              !/^(([0-9a-fA-F]{1,4}:)*)?::([0-9a-fA-F]{1,4}(:)?)*$/.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid IPv6 address' }]) };
          break;
        case 'ip':
          if (!wasmValidateString('validate_ipv4_simd', current) &&
              !/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid IP address' }]) };
          break;
        case 'base64':
          if (!fastValidateBase64(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid base64' }]) };
          break;
        case 'datetime':
          if (!wasmValidateString('validate_iso_datetime', current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid datetime' }]) };
          break;
        case 'date':
          if (!fastValidateDate(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid date string' }]) };
          break;
        case 'time': {
          const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?$/;
          if (!timeRegex.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid time string' }]) };
          break;
        }
        case 'duration': {
          const durationRegex = /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/;
          if (!durationRegex.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid duration' }]) };
          break;
        }
        case 'regex':
          if (!check.value.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid' }]) };
          break;
        case 'includes':
          if (!current.includes(check.value))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || `Must include "${check.value}"` }]) };
          break;
        case 'startsWith':
          if (!current.startsWith(check.value))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || `Must start with "${check.value}"` }]) };
          break;
        case 'endsWith':
          if (!current.endsWith(check.value))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || `Must end with "${check.value}"` }]) };
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
        case 'lowercase':
          current = current.toLowerCase();
          break;
        case 'uppercase':
          current = current.toUpperCase();
          break;
        case 'normalize':
          current = current.normalize(check.value || 'NFC');
          break;
        case 'slugify':
          current = current.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          break;
        case 'jwt':
          if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid JWT' }]) };
          break;
        case 'nanoid':
          if (!/^[A-Za-z0-9_-]{21}$/.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid nanoid' }]) };
          break;
        case 'base64url':
          if (!/^[A-Za-z0-9_-]+$/.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid base64url' }]) };
          break;
        case 'cidrv4':
          if (!/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid CIDR v4' }]) };
          break;
        case 'cidrv6':
          if (!/^[0-9a-fA-F:]+\/\d{1,3}$/.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid CIDR v6' }]) };
          break;
        case 'e164':
          if (!/^\+[1-9]\d{1,14}$/.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid E.164 phone number' }]) };
          break;
        case 'mac':
          if (!/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid MAC address' }]) };
          break;
        case 'xid':
          if (!/^[0-9a-v]{20}$/.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid XID' }]) };
          break;
        case 'ksuid':
          if (!/^[0-9A-Za-z]{27}$/.test(current))
            return { success: false, error: new ZodError([{ code: 'invalid_string', path, message: check.message || 'Invalid KSUID' }]) };
          break;
      }
    }

    return { success: true, data: current };
  }

  min(length: number, message?: string): this { this.checks.push({ type: 'min', value: length, message }); return this; }
  max(length: number, message?: string): this { this.checks.push({ type: 'max', value: length, message }); return this; }
  length(length: number, message?: string): this { this.checks.push({ type: 'length', value: length, message }); return this; }
  email(message?: string): this { this.checks.push({ type: 'email', message }); return this; }
  url(message?: string): this { this.checks.push({ type: 'url', message }); return this; }
  uuid(message?: string): this { this.checks.push({ type: 'uuid', message }); return this; }
  cuid(message?: string): this { this.checks.push({ type: 'cuid', message }); return this; }
  cuid2(message?: string): this { this.checks.push({ type: 'cuid2', message }); return this; }
  ulid(message?: string): this { this.checks.push({ type: 'ulid', message }); return this; }
  emoji(message?: string): this { this.checks.push({ type: 'emoji', message }); return this; }
  ip(message?: string): this { this.checks.push({ type: 'ip', message }); return this; }
  ipv4(message?: string): this { this.checks.push({ type: 'ipv4', message }); return this; }
  ipv6(message?: string): this { this.checks.push({ type: 'ipv6', message }); return this; }
  base64(message?: string): this { this.checks.push({ type: 'base64', message }); return this; }
  datetime(opts?: { message?: string; offset?: boolean; precision?: number }): this { this.checks.push({ type: 'datetime', message: opts?.message }); return this; }
  date(message?: string): this { this.checks.push({ type: 'date', message }); return this; }
  time(opts?: { message?: string; precision?: number }): this { this.checks.push({ type: 'time', message: opts?.message }); return this; }
  duration(message?: string): this { this.checks.push({ type: 'duration', message }); return this; }
  regex(pattern: RegExp, message?: string): this { this.checks.push({ type: 'regex', value: pattern, message }); return this; }
  includes(substr: string, opts?: { message?: string; position?: number }): this { this.checks.push({ type: 'includes', value: substr, message: opts?.message }); return this; }
  startsWith(prefix: string, message?: string): this { this.checks.push({ type: 'startsWith', value: prefix, message }); return this; }
  endsWith(suffix: string, message?: string): this { this.checks.push({ type: 'endsWith', value: suffix, message }); return this; }
  trim(): this { this.checks.push({ type: 'trim' }); return this; }
  toLowerCase(): this { this.checks.push({ type: 'toLowerCase' }); return this; }
  toUpperCase(): this { this.checks.push({ type: 'toUpperCase' }); return this; }
  normalize(form?: string): this { this.checks.push({ type: 'normalize', value: form || 'NFC' }); return this; }
  slugify(): this { this.checks.push({ type: 'slugify' }); return this; }
  nonempty(message?: string): this { this.checks.push({ type: 'nonempty', message }); return this; }

  // Zod 4: case transforms
  lowercase(message?: string): this { this.checks.push({ type: 'lowercase', message }); return this; }
  uppercase(message?: string): this { this.checks.push({ type: 'uppercase', message }); return this; }

  // Zod 4: additional format validators
  jwt(message?: string): this { this.checks.push({ type: 'jwt', message }); return this; }
  nanoid(message?: string): this { this.checks.push({ type: 'nanoid', message }); return this; }
  base64url(message?: string): this { this.checks.push({ type: 'base64url', message }); return this; }
  guid(message?: string): this { this.checks.push({ type: 'uuid', message }); return this; } // guid = less strict uuid
  cidrv4(message?: string): this { this.checks.push({ type: 'cidrv4', message }); return this; }
  cidrv6(message?: string): this { this.checks.push({ type: 'cidrv6', message }); return this; }
  e164(message?: string): this { this.checks.push({ type: 'e164', message }); return this; }
  mac(message?: string): this { this.checks.push({ type: 'mac', message }); return this; }
  xid(message?: string): this { this.checks.push({ type: 'xid', message }); return this; }
  ksuid(message?: string): this { this.checks.push({ type: 'ksuid', message }); return this; }
  uuidv4(message?: string): this { return this.uuid(message); }
  uuidv6(message?: string): this { return this.uuid(message); }
  uuidv7(message?: string): this { return this.uuid(message); }

  // Zod 4 aliases
  minLength(length: number, message?: string): this { return this.min(length, message); }
  maxLength(length: number, message?: string): this { return this.max(length, message); }

  protected _toJsonSchemaCore(): Record<string, any> {
    const schema: Record<string, any> = { type: 'string' };
    for (const check of this.checks) {
      switch (check.type) {
        case 'min': schema.minLength = check.value; break;
        case 'max': schema.maxLength = check.value; break;
        case 'length': schema.minLength = schema.maxLength = check.value; break;
        case 'email': schema.format = 'email'; break;
        case 'url': schema.format = 'uri'; break;
        case 'uuid': schema.format = 'uuid'; break;
        case 'datetime': schema.format = 'date-time'; break;
        case 'date': schema.format = 'date'; break;
        case 'time': schema.format = 'time'; break;
        case 'duration': schema.format = 'duration'; break;
        case 'ipv4': schema.format = 'ipv4'; break;
        case 'ipv6': schema.format = 'ipv6'; break;
        case 'regex': schema.pattern = check.value.source; break;
      }
    }
    return schema;
  }
}

export class DhiNumber extends DhiType<number, number> {
  private checks: Array<{ type: string; value?: any; message?: string }> = [];

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<number> {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected number, received ' + typeof value, expected: 'number', received: typeof value }]) };
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
          if (!Number.isInteger(value))
            return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: check.message || 'Expected integer, received float' }]) };
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
          if (value % check.value !== 0)
            return { success: false, error: new ZodError([{ code: 'not_multiple_of', path, message: check.message || `Number must be a multiple of ${check.value}` }]) };
          break;
        case 'finite':
          if (!Number.isFinite(value))
            return { success: false, error: new ZodError([{ code: 'not_finite', path, message: check.message || 'Number must be finite' }]) };
          break;
        case 'safe':
          if (!Number.isSafeInteger(value))
            return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: check.message || 'Number must be a safe integer' }]) };
          break;
      }
    }

    return { success: true, data: value };
  }

  min(value: number, message?: string): this { this.checks.push({ type: 'min', value, message }); return this; }
  max(value: number, message?: string): this { this.checks.push({ type: 'max', value, message }); return this; }
  gt(value: number, message?: string): this { this.checks.push({ type: 'gt', value, message }); return this; }
  gte(value: number, message?: string): this { this.checks.push({ type: 'gte', value, message }); return this; }
  lt(value: number, message?: string): this { this.checks.push({ type: 'lt', value, message }); return this; }
  lte(value: number, message?: string): this { this.checks.push({ type: 'lte', value, message }); return this; }
  int(message?: string): this { this.checks.push({ type: 'int', message }); return this; }
  positive(message?: string): this { this.checks.push({ type: 'positive', message }); return this; }
  negative(message?: string): this { this.checks.push({ type: 'negative', message }); return this; }
  nonnegative(message?: string): this { this.checks.push({ type: 'nonnegative', message }); return this; }
  nonpositive(message?: string): this { this.checks.push({ type: 'nonpositive', message }); return this; }
  multipleOf(value: number, message?: string): this { this.checks.push({ type: 'multipleOf', value, message }); return this; }
  step(value: number, message?: string): this { this.checks.push({ type: 'step', value, message }); return this; }
  finite(message?: string): this { this.checks.push({ type: 'finite', message }); return this; }
  safe(message?: string): this { this.checks.push({ type: 'safe', message }); return this; }

  // Zod 4 aliases
  minimum(value: number, message?: string): this { return this.gte(value, message); }
  maximum(value: number, message?: string): this { return this.lte(value, message); }

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

  min(value: bigint, message?: string): this { this.checks.push({ type: 'min', value, message }); return this; }
  max(value: bigint, message?: string): this { this.checks.push({ type: 'max', value, message }); return this; }
  gt(value: bigint, message?: string): this { this.checks.push({ type: 'gt', value, message }); return this; }
  gte(value: bigint, message?: string): this { this.checks.push({ type: 'gte', value, message }); return this; }
  lt(value: bigint, message?: string): this { this.checks.push({ type: 'lt', value, message }); return this; }
  lte(value: bigint, message?: string): this { this.checks.push({ type: 'lte', value, message }); return this; }
  positive(message?: string): this { this.checks.push({ type: 'positive', message }); return this; }
  negative(message?: string): this { this.checks.push({ type: 'negative', message }); return this; }
  nonnegative(message?: string): this { this.checks.push({ type: 'nonnegative', message }); return this; }
  nonpositive(message?: string): this { this.checks.push({ type: 'nonpositive', message }); return this; }
  multipleOf(value: bigint, message?: string): this { this.checks.push({ type: 'multipleOf', value, message }); return this; }
}

export class DhiBoolean extends DhiType<boolean, boolean> {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<boolean> {
    if (typeof value !== 'boolean') {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected boolean, received ' + typeof value }]) };
    }
    return { success: true, data: value };
  }

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

  min(date: Date, message?: string): this { this.checks.push({ type: 'min', value: date, message }); return this; }
  max(date: Date, message?: string): this { this.checks.push({ type: 'max', value: date, message }); return this; }

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
}

export class DhiNull extends DhiType<null, null> {
  _parse(value: unknown, path: (string | number)[]): SafeParseResult<null> {
    if (value !== null) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected null' }]) };
    }
    return { success: true, data: null };
  }

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
// Object Schema
// ============================================================================

export class DhiObject<T extends Record<string, DhiType<any, any>>> extends DhiType<
  { [K in RequiredKeys<T> & string]: T[K]["_output"] } & { [K in OptionalKeys<T> & string]?: T[K]["_output"] },
  { [K in RequiredKeys<T> & string]: T[K]["_input"] } & { [K in OptionalKeys<T> & string]?: T[K]["_input"] }
> {
  readonly shape: T;
  private _keys: string[];
  private _unknownKeys: 'strip' | 'strict' | 'passthrough' = 'strip';
  private _catchall?: DhiType<any, any>;
  private _jit: ((value: any) => any) | null | undefined = undefined; // undefined = not compiled yet

  constructor(shape: T) {
    super();
    this.shape = shape;
    this._keys = Object.keys(shape);
  }

  private _compileJIT(): ((value: any) => any) | null {
    if (this._unknownKeys !== 'strip') return null;

    const keys = this._keys;
    const shape = this.shape;
    const closureVars: any[] = [];
    const closureNames: string[] = [];
    const bodyLines: string[] = [];

    bodyLines.push('return function(v){');
    bodyLines.push('if(typeof v!=="object"||v===null||Array.isArray(v))return null;');

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const ks = JSON.stringify(key);
      const vi = `v${i}`;
      bodyLines.push(`var ${vi}=v[${ks}];`);

      const schema = shape[key];
      const emitted = this._emitFieldCheck(vi, schema, closureVars, closureNames, i);
      if (!emitted) return null; // Can't JIT this schema, fallback
      bodyLines.push(emitted);
    }

    // Build result object
    bodyLines.push('return{');
    for (let i = 0; i < keys.length; i++) {
      bodyLines.push(`${JSON.stringify(keys[i])}:v${i},`);
    }
    bodyLines.push('};};');

    try {
      const fn = new Function(...closureNames, bodyLines.join('\n'));
      return fn(...closureVars);
    } catch {
      return null;
    }
  }

  private _emitFieldCheck(vi: string, schema: DhiType<any, any>, vars: any[], names: string[], idx: number): string | null {
    // Unwrap optional/nullable
    if (schema instanceof DhiOptional) {
      const inner = (schema as any)._inner;
      const innerCheck = this._emitFieldCheck(vi, inner, vars, names, idx);
      if (!innerCheck) return null;
      return `if(${vi}!==undefined){${innerCheck}}`;
    }
    if (schema instanceof DhiNullable) {
      const inner = (schema as any)._inner;
      const innerCheck = this._emitFieldCheck(vi, inner, vars, names, idx);
      if (!innerCheck) return null;
      return `if(${vi}!==null){${innerCheck}}`;
    }

    if (schema instanceof DhiString) {
      const checks = (schema as any).checks;
      let code = `if(typeof ${vi}!=="string")return null;`;
      for (const check of checks) {
        switch (check.type) {
          case 'min': code += `if(${vi}.length<${check.value})return null;`; break;
          case 'max': code += `if(${vi}.length>${check.value})return null;`; break;
          case 'length': code += `if(${vi}.length!==${check.value})return null;`; break;
          case 'nonempty': code += `if(${vi}.length===0)return null;`; break;
          case 'email': {
            const fname = `_e${idx}`;
            names.push(fname);
            vars.push(fastValidateEmail);
            code += `if(!${fname}(${vi}))return null;`;
            break;
          }
          case 'uuid': {
            const fname = `_u${idx}`;
            names.push(fname);
            vars.push(fastValidateUuid);
            code += `if(!${fname}(${vi}))return null;`;
            break;
          }
          case 'url': {
            const fname = `_url${idx}`;
            names.push(fname);
            vars.push((s: string) => wasmValidateString('validate_url_simd', s));
            code += `if(!${fname}(${vi}))return null;`;
            break;
          }
          case 'base64': {
            const fname = `_b${idx}`;
            names.push(fname);
            vars.push(fastValidateBase64);
            code += `if(!${fname}(${vi}))return null;`;
            break;
          }
          case 'date': {
            const fname = `_d${idx}`;
            names.push(fname);
            vars.push(fastValidateDate);
            code += `if(!${fname}(${vi}))return null;`;
            break;
          }
          case 'includes': code += `if(!${vi}.includes(${JSON.stringify(check.value)}))return null;`; break;
          case 'startsWith': code += `if(!${vi}.startsWith(${JSON.stringify(check.value)}))return null;`; break;
          case 'endsWith': code += `if(!${vi}.endsWith(${JSON.stringify(check.value)}))return null;`; break;
          case 'trim': code += `${vi}=${vi}.trim();`; break;
          case 'toLowerCase': code += `${vi}=${vi}.toLowerCase();`; break;
          case 'toUpperCase': code += `${vi}=${vi}.toUpperCase();`; break;
          case 'regex': {
            const fname = `_rx${idx}`;
            names.push(fname);
            vars.push(check.value);
            code += `if(!${fname}.test(${vi}))return null;`;
            break;
          }
          default: return null; // Can't JIT this check
        }
      }
      return code;
    }

    if (schema instanceof DhiNumber) {
      const checks = (schema as any).checks;
      let code = `if(typeof ${vi}!=="number"||${vi}!==${vi})return null;`;
      for (const check of checks) {
        switch (check.type) {
          case 'min': code += `if(${vi}<${check.value})return null;`; break;
          case 'max': code += `if(${vi}>${check.value})return null;`; break;
          case 'gt': code += `if(${vi}<=${check.value})return null;`; break;
          case 'gte': code += `if(${vi}<${check.value})return null;`; break;
          case 'lt': code += `if(${vi}>=${check.value})return null;`; break;
          case 'lte': code += `if(${vi}>${check.value})return null;`; break;
          case 'int': code += `if(${vi}!==(${vi}|0)&&!Number.isInteger(${vi}))return null;`; break;
          case 'positive': code += `if(${vi}<=0)return null;`; break;
          case 'negative': code += `if(${vi}>=0)return null;`; break;
          case 'nonnegative': code += `if(${vi}<0)return null;`; break;
          case 'nonpositive': code += `if(${vi}>0)return null;`; break;
          case 'finite': code += `if(!isFinite(${vi}))return null;`; break;
          case 'multipleOf': code += `if(${vi}%${check.value}!==0)return null;`; break;
          case 'safe': code += `if(${vi}<-9007199254740991||${vi}>9007199254740991)return null;`; break;
          default: return null;
        }
      }
      return code;
    }

    if (schema instanceof DhiBoolean) {
      return `if(typeof ${vi}!=="boolean")return null;`;
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
      const fname = `_obj${idx}`;
      names.push(fname);
      // Ensure nested object has its JIT compiled
      if ((schema as any)._jit === undefined) {
        (schema as any)._jit = (schema as any)._compileJIT();
      }
      const nestedJit = (schema as any)._jit;
      if (nestedJit) {
        vars.push(nestedJit);
        return `${vi}=${fname}(${vi});if(${vi}===null)return null;`;
      }
      return null; // Can't JIT nested object
    }

    if (schema instanceof DhiArray) {
      const elem = (schema as any).element;
      const elemChecks = (schema as any).checks;
      // Only JIT simple arrays (no length checks, primitive elements)
      if (elemChecks.length === 0) {
        if (elem instanceof DhiNumber && (elem as any).checks.length === 0) {
          return `if(!Array.isArray(${vi}))return null;for(var _i${idx}=0;_i${idx}<${vi}.length;_i${idx}++){if(typeof ${vi}[_i${idx}]!=="number")return null;}`;
        }
        if (elem instanceof DhiString && (elem as any).checks.length === 0) {
          return `if(!Array.isArray(${vi}))return null;for(var _i${idx}=0;_i${idx}<${vi}.length;_i${idx}++){if(typeof ${vi}[_i${idx}]!=="string")return null;}`;
        }
        if (elem instanceof DhiBoolean) {
          return `if(!Array.isArray(${vi}))return null;for(var _i${idx}=0;_i${idx}<${vi}.length;_i${idx}++){if(typeof ${vi}[_i${idx}]!=="boolean")return null;}`;
        }
      }
      return null; // Can't JIT complex arrays
    }

    return null; // Unknown schema type, can't JIT
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
          hasError = true;
          break;
        }
        result[key] = fieldResult.data;
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
          for (let i = 0; i < objKeys.length; i++) {
            const key = objKeys[i];
            if (!keys.includes(key)) {
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
    for (let ki = 0; ki < keys.length; ki++) {
      const key = keys[ki];
      const fieldResult = shape[key]._parse(obj[key], [...path, key]);
      if (!fieldResult.success) {
        issues.push(...fieldResult.error.issues);
      }
    }
    return { success: false, error: new ZodError(issues) };
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

    for (const key of this._keys) {
      const fieldSchema = this.shape[key];
      properties[key] = fieldSchema.toJsonSchema();
      // Check if field is optional
      if (!fieldSchema.isOptional()) {
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

  constructor(private element: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"][]> {
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
    if (elem instanceof DhiNumber && (elem as any).checks.length === 0) {
      for (let i = 0; i < len; i++) {
        if (typeof value[i] !== 'number') {
          return { success: false, error: new ZodError([{ code: 'invalid_type', path: [...path, i], message: 'Expected number, received ' + typeof value[i] }]) };
        }
      }
      return { success: true, data: value as any };
    }
    if (elem instanceof DhiString && (elem as any).checks.length === 0) {
      for (let i = 0; i < len; i++) {
        if (typeof value[i] !== 'string') {
          return { success: false, error: new ZodError([{ code: 'invalid_type', path: [...path, i], message: 'Expected string, received ' + typeof value[i] }]) };
        }
      }
      return { success: true, data: value as any };
    }
    if (elem instanceof DhiBoolean) {
      for (let i = 0; i < len; i++) {
        if (typeof value[i] !== 'boolean') {
          return { success: false, error: new ZodError([{ code: 'invalid_type', path: [...path, i], message: 'Expected boolean, received ' + typeof value[i] }]) };
        }
      }
      return { success: true, data: value as any };
    }

    // General path: full validation with path tracking
    // Use a reusable child path to avoid spreading on every iteration
    const childPath = path.concat(0 as any);
    const lastIdx = childPath.length - 1;
    const result: T["_output"][] = new Array(len);
    const issues: ZodIssue[] = [];

    for (let i = 0; i < len; i++) {
      childPath[lastIdx] = i;
      const r = elem._parse(value[i], childPath);
      if (!r.success) {
        // Create a fresh path copy for the error (since childPath is reused)
        for (const issue of r.error.issues) {
          issues.push({ ...issue, path: [...issue.path] });
        }
      } else {
        result[i] = r.data;
      }
    }

    if (issues.length > 0) {
      return { success: false, error: new ZodError(issues) };
    }

    return { success: true, data: result };
  }

  min(length: number, message?: string): this { this.checks.push({ type: 'min', value: length, message }); return this; }
  max(length: number, message?: string): this { this.checks.push({ type: 'max', value: length, message }); return this; }
  length(length: number, message?: string): this { this.checks.push({ type: 'length', value: length, message }); return this; }
  nonempty(message?: string): this { this.checks.push({ type: 'nonempty', message }); return this; }

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

  constructor(private items: T) { super(); }

  rest<R extends DhiType<any, any>>(schema: R): DhiTuple<T> {
    const clone = new DhiTuple(this.items);
    clone._rest = schema;
    return clone as any;
  }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<TupleOutput<T>> {
    if (!Array.isArray(value)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected array (tuple)' }]) };
    }

    if (!this._rest && value.length !== this.items.length) {
      return { success: false, error: new ZodError([{ code: 'too_small', path, message: `Expected ${this.items.length} items, got ${value.length}` }]) };
    }

    if (value.length < this.items.length) {
      return { success: false, error: new ZodError([{ code: 'too_small', path, message: `Expected at least ${this.items.length} items` }]) };
    }

    const result: any[] = [];
    const issues: ZodIssue[] = [];

    for (let i = 0; i < this.items.length; i++) {
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
  constructor(private keySchema: K, private valueSchema: V) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<Record<K["_output"], V["_output"]>> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected object' }]) };
    }

    const result: Record<string, any> = {};
    const issues: ZodIssue[] = [];

    for (const [key, val] of Object.entries(value)) {
      const keyResult = this.keySchema._parse(key, [...path, key]);
      if (!keyResult.success) {
        issues.push(...keyResult.error.issues);
        continue;
      }

      const valResult = this.valueSchema._parse(val, [...path, key]);
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

  min(size: number, message?: string): this { this.checks.push({ type: 'min', value: size, message }); return this; }
  max(size: number, message?: string): this { this.checks.push({ type: 'max', value: size, message }); return this; }
  size(size: number, message?: string): this { this.checks.push({ type: 'size', value: size, message }); return this; }
  nonempty(message?: string): this { this.checks.push({ type: 'nonempty', message }); return this; }
}

// ============================================================================
// Union & Discriminated Union & Intersection
// ============================================================================

type UnionOutput<T extends DhiType<any, any>[]> = T[number]["_output"];
type UnionInput<T extends DhiType<any, any>[]> = T[number]["_input"];

export class DhiUnion<T extends [DhiType<any, any>, ...DhiType<any, any>[]]> extends DhiType<UnionOutput<T>, UnionInput<T>> {
  constructor(private options: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<UnionOutput<T>> {
    const issues: ZodIssue[] = [];
    for (const option of this.options) {
      const result = option._parse(value, path);
      if (result.success) return result;
      issues.push(...result.error.issues);
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

export class DhiPipe<A extends DhiType<any, any>, B extends DhiType<any, any>> extends DhiType<B["_output"], A["_input"]> {
  constructor(private _a: A, private _b: B) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<B["_output"]> {
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

  min(size: number, message?: string): this { this.checks.push({ type: 'min', value: size, message }); return this; }
  max(size: number, message?: string): this { this.checks.push({ type: 'max', value: size, message }); return this; }
  mime(types: string | string[], message?: string): this { this.checks.push({ type: 'mime', value: types, message }); return this; }
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
    if (typeof value === 'string' || typeof value === 'number') {
      return super._parse(new Date(value), path);
    }
    return super._parse(value, path);
  }
}

// ============================================================================
// StringBool (Zod 4 feature)
// ============================================================================

export class DhiStringBool extends DhiType<boolean, string> {
  private _trueValues = new Set(['true', '1', 'yes', 'on']);
  private _falseValues = new Set(['false', '0', 'no', 'off']);

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<boolean> {
    if (typeof value !== 'string') {
      return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Expected string' }]) };
    }
    const lower = value.toLowerCase();
    if (this._trueValues.has(lower)) return { success: true, data: true };
    if (this._falseValues.has(lower)) return { success: true, data: false };
    return { success: false, error: new ZodError([{ code: 'invalid_type', path, message: 'Invalid boolean string' }]) };
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

export class DhiSuccess<T extends DhiType<any, any>> extends DhiType<T["_output"], T["_input"]> {
  constructor(private _inner: T) { super(); }

  _parse(value: unknown, path: (string | number)[]): SafeParseResult<T["_output"]> {
    const result = this._inner._parse(value, path);
    // Always return success, using undefined if validation fails
    if (!result.success) {
      return { success: true, data: undefined as any };
    }
    return result;
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
declare module './schema-edge' {
  interface DhiType<Output, Input> {
    register(metadata: GlobalMeta): this;
  }
}

// ============================================================================
// Main Export: z namespace (Zod 4 compatible)
// ============================================================================

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
  enum: <T extends readonly [string, ...string[]]>(values: T) => new DhiEnum(values),
  nativeEnum: <T extends Record<string, string | number>>(enumObj: T) => new DhiNativeEnum(enumObj),

  // Composites
  object: <T extends Record<string, DhiType<any, any>>>(shape: T) => new DhiObject(shape),
  array: <T extends DhiType<any, any>>(schema: T) => new DhiArray(schema),
  tuple: <T extends [DhiType<any, any>, ...DhiType<any, any>[]]>(items: T) => new DhiTuple(items),
  record: <K extends DhiType<string, string>, V extends DhiType<any, any>>(keyOrValue: K | V, value?: V) => {
    if (value) return new DhiRecord(keyOrValue as K, value);
    return new DhiRecord(new DhiString() as any, keyOrValue as V);
  },
  // Zod 4: partialRecord - record with optional keys
  partialRecord: <K extends DhiType<string, string>, V extends DhiType<any, any>>(keySchema: K, valueSchema: V) =>
    new DhiRecord(keySchema, new DhiOptional(valueSchema)),
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
  function: () => new DhiFunction(),
  instanceof: <T extends abstract new (...args: any[]) => any>(cls: T) => new DhiInstanceOf(cls),

  // Modifiers
  optional: <T extends DhiType<any, any>>(schema: T) => new DhiOptional(schema),
  nullable: <T extends DhiType<any, any>>(schema: T) => new DhiNullable(schema),

  // Effects
  preprocess: <T extends DhiType<any, any>>(preprocess: (value: unknown) => unknown, schema: T) => new DhiPreprocess(preprocess, schema),
  custom: <T>(check: (value: unknown) => value is T, params?: { message?: string }) => new DhiCustom(check, params),

  // Zod 4: stringbool
  stringbool: () => new DhiStringBool(),

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

  // Zod 4: Top-level string format shortcuts
  email: () => new DhiString().email(),
  uuid: () => new DhiString().uuid(),
  url: () => new DhiString().url(),
  httpUrl: () => new DhiString().url(), // Same as url for now
  hostname: () => new DhiString().regex(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/),
  emoji: () => new DhiString().emoji(),
  base64: () => new DhiString().base64(),
  base64url: () => new DhiString().base64url(),
  jwt: () => new DhiString().jwt(),
  nanoid: () => new DhiString().nanoid(),
  cuid: () => new DhiString().cuid(),
  cuid2: () => new DhiString().cuid2(),
  ulid: () => new DhiString().ulid(),
  ipv4: () => new DhiString().ipv4(),
  ipv6: () => new DhiString().ipv6(),
  ip: () => new DhiString().ip(),
  mac: () => new DhiString().mac(),
  cidrv4: () => new DhiString().cidrv4(),
  cidrv6: () => new DhiString().cidrv6(),
  guid: () => new DhiString().guid(),
  e164: () => new DhiString().e164(),
  hex: () => new DhiString().regex(/^[0-9a-fA-F]+$/),
  lowercase: () => new DhiString().regex(/^[a-z]*$/),
  uppercase: () => new DhiString().regex(/^[A-Z]*$/),

  // Zod 4: Hash validation
  hash: (algorithm: 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512') => {
    const lengths: Record<string, number> = {
      md5: 32,
      sha1: 40,
      sha256: 64,
      sha384: 96,
      sha512: 128,
    };
    return new DhiString().regex(new RegExp(`^[0-9a-fA-F]{${lengths[algorithm]}}$`));
  },

  // Zod 4: iso namespace for date/time formats
  iso: {
    datetime: () => new DhiString().datetime(),
    date: () => new DhiString().date(),
    time: () => new DhiString().time(),
    duration: () => new DhiString().duration(),
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
    // For now we generate draft-2020-12 compatible schema
    // The target param is accepted for API compatibility but doesn't change output yet
    return schema.toJsonSchema();
  },
} as const;

// Type-level utilities
export namespace z {
  export type infer<T extends DhiType<any, any>> = T["_output"];
  export type input<T extends DhiType<any, any>> = T["_input"];
  export type output<T extends DhiType<any, any>> = T["_output"];
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

// Default export
export default z;
