/**
 * Differential parity test: dhi vs the real Zod 4 package.
 *
 * Every case builds the SAME schema with both libraries (dhi's API is Zod's
 * API) and runs it over a corpus of inputs. For each input the accept/reject
 * decision must match, and when both accept, the parsed output must be
 * identical. A mismatch is a parity bug in dhi.
 */
import { z as zod } from 'zod';
import { z as dhi } from '../schema';

type Lib = typeof zod | typeof dhi;
interface Case {
  name: string;
  build: (z: any) => { safeParse: (v: unknown) => any };
  inputs: unknown[];
  compareData?: boolean;
}

const cases: Case[] = [];
function add(name: string, build: (z: any) => any, inputs: unknown[], compareData = true) {
  cases.push({ name, build, inputs, compareData });
}

const NON_STRINGS = [42, 0, null, undefined, true, {}, [], () => {}, Symbol('s'), 10n, NaN];

// ---------------------------------------------------------------------------
// String formats
// ---------------------------------------------------------------------------
const EMAILS = [
  'a@b.co', 'user+tag@example.com', "o'neil@example.com", 'a.b@c.com', 'first.last@sub.example.co.uk',
  '.a@b.co', 'a.@b.co', 'a..b@c.co', 'a@b', 'a@b.c', 'a@-b.co', 'a@b-.co', 'a@b.c0', 'a%b@c.co',
  'a@b..co', '@b.co', 'a@', '', 'a b@c.co', 'a@b.co ', 'ünïcode@b.co', 'a@b.123', 'a@1.co',
  'a@@b.co', 'a@b.co@c.co', 'A@B.CO', 'a_b-c+d@x-y.example', 'a@b.corporate',
];
add('string().email()', z => z.string().email(), [...EMAILS, ...NON_STRINGS]);
add('email()', z => z.email(), EMAILS);

const URLS = [
  'https://example.com', 'http://x', 'ftp://nope.com', 'mailto:a@b.co', 'invalid', '', 'https://',
  'example.com', 'http://localhost:3000/p?q=1#h', ' https://example.com ', 'https://exa mple.com',
  'javascript:alert(1)', 'file:///tmp/x', 'http://256.256.256.256', 'http://[::1]/', 'HTTPS://EXAMPLE.COM/A',
  'https://user:pw@example.com:8443/path', 'http://例え.テスト', 'https://example', 'https://example.com/ünï',
];
add('string().url()', z => z.string().url(), [...URLS, ...NON_STRINGS]);
add('url()', z => z.url(), URLS);
add('httpUrl()', z => z.httpUrl(), URLS);
add('url({ hostname })', z => z.url({ hostname: /^example\.com$/ }), URLS);
add('url({ protocol })', z => z.url({ protocol: /^ftp$/ }), URLS);
add('url({ normalize })', z => z.url({ normalize: true }), URLS);

const UUIDS = [
  '550e8400-e29b-41d4-a716-446655440000', '00000000-0000-0000-0000-000000000000',
  'ffffffff-ffff-ffff-ffff-ffffffffffff', 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
  '12345678-1234-1234-1234-123456789abc', '12345678-1234-0234-8234-123456789abc',
  '12345678-1234-9234-8234-123456789abc', '12345678-1234-4234-c234-123456789abc',
  '12345678-1234-4234-B234-123456789ABC', '1ec9414c-232a-6b00-b3c8-9e6bdeced846',
  '017f22e2-79b0-7cc3-98c4-dc0c0c07398f', '550e8400e29b41d4a716446655440000', 'not-a-uuid',
  '550E8400-E29B-41D4-A716-446655440000', '', '550e8400-e29b-41d4-a716-44665544000g',
  '550e8400-e29b-41d4-a716-4466554400000', ' 550e8400-e29b-41d4-a716-446655440000',
];
add('string().uuid()', z => z.string().uuid(), [...UUIDS, ...NON_STRINGS]);
add('uuid()', z => z.uuid(), UUIDS);
add('uuidv4()', z => z.uuidv4(), UUIDS);
add('uuidv6()', z => z.uuidv6(), UUIDS);
add('uuidv7()', z => z.uuidv7(), UUIDS);
add('guid()', z => z.guid(), UUIDS);

add('cuid()', z => z.cuid(), ['cjld2cjxh0000qzrmn831i7rn', 'Cjld2cjxh0000qzrmn831i7rn', 'c123', 'xjld2cjxh0000qzrmn831i7rn', 'c jld2cjxh0000', 'c-jld2cjxh0000', '', 'c12345678', 'c1234567']);
add('cuid2()', z => z.cuid2(), ['tz4a98xxat96iws9zmbrgj3a', 'TZ4A98XXAT96IWS9ZMBRGJ3A', '', 'abc-def', 'a', 'a b']);
add('ulid()', z => z.ulid(), ['01ARZ3NDEKTSV4RRFFQ69G5FAV', '01arz3ndektsv4rrffq69g5fav', '01ARZ3NDEKTSV4RRFFQ69G5FA', '01ARZ3NDEKTSV4RRFFQ69G5FAVX', 'I1ARZ3NDEKTSV4RRFFQ69G5FAV', '', 'L1ARZ3NDEKTSV4RRFFQ69G5FAV']);
add('xid()', z => z.xid(), ['9m4e2mr0ui3e8a215n4g', '9M4E2MR0UI3E8A215N4G', '9m4e2mr0ui3e8a215n4gx', '9m4e2mr0ui3e8a215n4w', '', '9m4e2mr0ui3e8a215n4']);
add('ksuid()', z => z.ksuid(), ['0ujtsYcgvSTl8PAuAdqWYSMnLOv', '0ujtsYcgvSTl8PAuAdqWYSMnLO', '0ujtsYcgvSTl8PAuAdqWYSMnLOv!', '', '0ujtsYcgvSTl8PAuAdqWYSMnLOvX']);
add('nanoid()', z => z.nanoid(), ['V1StGXR8_Z5jdHi6B-myT', 'V1StGXR8_Z5jdHi6B-my', 'V1StGXR8_Z5jdHi6B-myT!', '', 'V1StGXR8_Z5jdHi6B-myTT']);
add('emoji()', z => z.emoji(), ['😀', '😀👍', '1', 'a😀', '#', '🇺🇸', '👨‍👩‍👧', '', ' ', '❤️', '*', '😀 😀']);

const IPV4S = ['192.168.1.1', '0.0.0.0', '255.255.255.255', '256.1.1.1', '01.1.1.1', '1.1.1', '1.1.1.1.1', 'a.b.c.d', '', '1.1.1.1 ', '00.0.0.0', '1.2.3.04', '1.2.3.', '.1.2.3', '1..2.3', '999.1.1.1', '1.2.3.4\n'];
const IPV6S = ['::1', '::', '2001:db8::1', '2001:0db8:85a3:0000:0000:8a2e:0370:7334', '2001:db8::1::2', '1:2:3:4:5:6:7:8', '1:2:3:4:5:6:7', 'fe80::1%eth0', '::ffff:192.0.2.128', 'g::1', '', '1::', ':1', '1:2:3:4:5:6:7:8:9', '12345::1', 'FE80::1', ':::', '1:2:3:4:5:6:7::', '::1:2:3:4:5:6:7', '1::2::3', '::1.2.3.4', '1:2:3:4:5:6:1.2.3.4', '1:2:3:4:5:6:7:1.2.3.4', 'ffff::256.1.1.1', '0:0:0:0:0:0:0:0', '00000::1', '1:2:3:4:5:6:7:8:', '::g', '[::1]', '::1/64', '::1#x', '1:2:3:4:5:6:7:8 '];
add('ipv4()', z => z.ipv4(), [...IPV4S, ...IPV6S]);
add('ipv6()', z => z.ipv6(), [...IPV4S, ...IPV6S]);
add('cidrv4()', z => z.cidrv4(), ['192.168.0.0/24', '192.168.0.0', '10.0.0.0/8', '10.0.0.0/33', '10.0.0.0/0', '256.0.0.0/8', '', '1.2.3.4/32', '1.2.3.4/032', '01.2.3.4/8', '1.2.3.4/-1']);
add('cidrv6()', z => z.cidrv6(), ['2001:db8::/32', '::/0', '::1/128', '2001:db8::/129', '2001:db8::', 'g::/32', '', '1:2:3:4:5:6:7:8/64', '::/00', 'fe80::/10']);

add('base64()', z => z.base64(), ['SGVsbG8=', 'dGVzdA==', 'YWJj', '', 'YWJ', 'YW==', 'YWJjZA', 'not base64!', 'YWJj====', '====', 'YWJjZA==', 'YW=j', 'YWJjZ===', 'SGVsbG8', 'a', 'ab', 'abc', 'abcd', 'ab=c', '+/+/', '-_-_']);
add('base64url()', z => z.base64url(), ['SGVsbG8', 'dGVzdA', '', 'a-b_c', 'a+b', 'a/b', 'a=', 'SGVsbG8=', 'abc def']);

const jwtHeader = (h: object) => btoa(JSON.stringify(h)).replace(/=+$/, '');
const JWTS = [
  `${jwtHeader({ alg: 'HS256', typ: 'JWT' })}.${btoa('{}')}.sig`,
  `${jwtHeader({ alg: 'RS256' })}.${btoa('{}')}.sig`,
  `${jwtHeader({ alg: 'HS256', typ: 'JOSE' })}.${btoa('{}')}.sig`,
  `${jwtHeader({ typ: 'JWT' })}.${btoa('{}')}.sig`,
  `${jwtHeader({ alg: 'none' })}.e30.`,
  'a.b.c', 'a.b', '', 'not.a.jwt.at.all', `${btoa('[1]')}.x.y`, `${btoa('"str"')}.x.y`,
];
add('jwt()', z => z.jwt(), JWTS);
add("jwt({ alg: 'HS256' })", z => z.jwt({ alg: 'HS256' }), JWTS);

add('e164()', z => z.e164(), ['+14155552671', '+1415555267', '+1', '+123456', '+1234567', '1234567890', '+0123456789', '+123456789012345', '+1234567890123456', '', '+1 415 555 2671', '+1-415']);
const MACS = ['00:1B:44:11:3A:B7', '00:1b:44:11:3a:b7', '00:1B:44:11:3a:B7', '00-1B-44-11-3A-B7', '001B44113AB7', 'not-a-mac', '', 'GG:1B:44:11:3A:B7', '00:1B:44:11:3A', '00:1B:44:11:3A:B7:00'];
add('mac()', z => z.mac(), MACS);
add("mac({ delimiter: '-' })", z => z.mac({ delimiter: '-' }), MACS);
add('hostname()', z => z.hostname(), ['example.com', 'sub.example.com', 'localhost', 'example.com.', '-bad.com', 'bad-.com', 'a'.repeat(64) + '.com', 'a'.repeat(63) + '.com', 'exa_mple.com', '', 'a', '1.2.3.4', 'xn--bcher-kva.example', 'a..b', '.a', ('a.'.repeat(130)) + 'a', 'ex ample.com']);
add('hex()', z => z.hex(), ['deadBEEF', '', '0x1', 'g', '123', 'DEADbeef00']);
add('string().check(z.lowercase())', z => z.string().check(z.lowercase()), ['abc', 'ABC', 'aBc', '', '123', 'abc123', 'ABC123', 'a b', 'ß', 'É']);
add('string().check(z.uppercase())', z => z.string().check(z.uppercase()), ['abc', 'ABC', 'aBc', '', '123', 'abc123', 'ABC123', 'A B', 'ß', 'É']);
add('string().lowercase()', z => z.string().lowercase(), ['abc', 'ABC', '']);
add('string().uppercase()', z => z.string().uppercase(), ['abc', 'ABC', '']);
add("hash('md5')", z => z.hash('md5'), ['d41d8cd98f00b204e9800998ecf8427e', 'D41D8CD98F00B204E9800998ECF8427E', 'd41d8cd98f00b204e9800998ecf8427', '', 'g41d8cd98f00b204e9800998ecf8427e']);
add("hash('sha256', { enc: 'hex' })", z => z.hash('sha256', { enc: 'hex' }), ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85', '']);
add("hash('sha256', { enc: 'base64' })", z => z.hash('sha256', { enc: 'base64' }), ['47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=', '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU', '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU', '']);
add("hash('sha1', { enc: 'base64url' })", z => z.hash('sha1', { enc: 'base64url' }), ['2jmj7l5rSw0yVb_vlWAYkK_YBwk', '2jmj7l5rSw0yVb/vlWAYkK/YBwk=', '2jmj7l5rSw0yVb_vlWAYkK_YBwk=', '']);

// ISO 8601
const DATES = ['2024-01-15', '2024-02-29', '2023-02-29', '2024-02-30', '2024-04-31', '2024-13-01', '2024-00-10', '2024-1-5', '20240115', '2024-01-15T00:00:00Z', '', '1900-02-29', '2000-02-29', '2100-02-29', 'abcd-01-15', '2024-01-32', '2024-12-31', '2024-01-00', '0000-01-01', '9999-12-31', '2024-06-31', '2024-11-31'];
add('iso.date()', z => z.iso.date(), [...DATES, ...NON_STRINGS]);
add('string().date()', z => z.string().date(), DATES);

const TIMES = ['10:30:00', '10:30', '10:30:00.123', '10:30:00.1', '25:00:00', '10:60:00', '10:30:60', '10:30:00Z', '10:30:00+02:00', '', '1:30:00', '10:30:00.', '23:59:59.999999', '00:00', '24:00:00', '10:30:00.1234'];
add('iso.time()', z => z.iso.time(), TIMES);
add('iso.time({ precision: 0 })', z => z.iso.time({ precision: 0 }), TIMES);
add('iso.time({ precision: 3 })', z => z.iso.time({ precision: 3 }), TIMES);
add('iso.time({ precision: -1 })', z => z.iso.time({ precision: -1 }), TIMES);

const DATETIMES = [
  '2024-01-15T10:30:00Z', '2024-01-15T10:30:00.123Z', '2024-01-15T10:30:00', '2024-01-15T10:30:00+02:00',
  '2024-01-15T10:30:00-05:30', '2024-01-15T10:30:00+2:00', '2024-01-15T10:30Z', '2024-01-15T10:30:00z',
  '2024-01-15 10:30:00Z', '2024-02-30T10:30:00Z', '2024-01-15T24:00:00Z', '2024-01-15T10:30:00.Z',
  '2024-01-15T10:30:00.1234Z', '', 'not-a-date', '2024-01-15T10:30:00+24:00', '2024-01-15T10:30:00+23:59',
  '2024-01-15T10:30:00.123+02:00', '2024-01-15T10:30', '2024-02-29T00:00:00Z', '2023-02-29T00:00:00Z',
  '2024-01-15T10:30:00.123456789Z', '2024-01-15T10:30:00+0200',
];
add('iso.datetime()', z => z.iso.datetime(), [...DATETIMES, ...NON_STRINGS]);
add('string().datetime()', z => z.string().datetime(), DATETIMES);
add('iso.datetime({ offset: true })', z => z.iso.datetime({ offset: true }), DATETIMES);
add('iso.datetime({ local: true })', z => z.iso.datetime({ local: true }), DATETIMES);
add('iso.datetime({ offset: true, local: true })', z => z.iso.datetime({ offset: true, local: true }), DATETIMES);
add('iso.datetime({ precision: 0 })', z => z.iso.datetime({ precision: 0 }), DATETIMES);
add('iso.datetime({ precision: 3 })', z => z.iso.datetime({ precision: 3 }), DATETIMES);
add('iso.datetime({ precision: -1 })', z => z.iso.datetime({ precision: -1 }), DATETIMES);
add('iso.datetime({ precision: 3, offset: true })', z => z.iso.datetime({ precision: 3, offset: true }), DATETIMES);

add('iso.duration()', z => z.iso.duration(), ['P1Y2M3D', 'PT1H', 'P1W', 'P1Y1W', 'P', 'PT', 'P1DT2H3M4S', 'P1DT2H3M4.5S', 'P1DT2H3M4,5S', 'P1DT', 'PT0S', '-P1D', 'P1.5Y', 'invalid', '', 'P1Y2M3DT4H5M6S', 'P2W3D', 'PT1H30M', 'P0D', 'PT36H', 'P1M', 'PT1M', 'P1YT', 'PT1.5H']);

// ---------------------------------------------------------------------------
// String checks & transforms
// ---------------------------------------------------------------------------
const STRS = ['', 'a', 'ab', 'abc', 'hello world', '  padded  ', 'HeLLo', 'héllo', '😀😀', 'a'.repeat(50), ...NON_STRINGS];
add('string()', z => z.string(), STRS);
add('string().min(2)', z => z.string().min(2), STRS);
add('string().max(3)', z => z.string().max(3), STRS);
add('string().length(3)', z => z.string().length(3), STRS);
add('string().nonempty()', z => z.string().nonempty(), STRS);
add('string().min(1).max(5)', z => z.string().min(1).max(5), STRS);
add("string().includes('lo')", z => z.string().includes('lo'), STRS);
add("string().includes('lo', { position: 3 })", z => z.string().includes('lo', { position: 3 }), STRS);
add("string().includes('lo', { position: 4 })", z => z.string().includes('lo', { position: 4 }), STRS);
add("string().startsWith('he')", z => z.string().startsWith('he'), STRS);
add("string().endsWith('lo')", z => z.string().endsWith('lo'), STRS);
add('string().regex(/^h/i)', z => z.string().regex(/^h/i), STRS);
add('string().regex(/l/g) (global flag reuse)', z => z.string().regex(/l/g), ['hello', 'hello', 'hello', 'xyz', 'hello', 'll']);
add('string().trim()', z => z.string().trim(), STRS);
add('string().trim().min(1)', z => z.string().trim().min(1), ['  ', ' a ', '']);
add('string().toLowerCase()', z => z.string().toLowerCase(), STRS);
add('string().toUpperCase()', z => z.string().toUpperCase(), STRS);
add("string().normalize('NFC')", z => z.string().normalize('NFC'), ['é', 'é', 'abc']);
add('string().min(2).regex(/^[a-z]+$/).max(4)', z => z.string().min(2).regex(/^[a-z]+$/).max(4), STRS);
add('string().email().min(6)', z => z.string().email().min(6), EMAILS);
add('string().trim().email()', z => z.string().trim().email(), [' a@b.co ', 'a@b.co', ' bad ']);

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------
const NUMS = [0, 1, -1, 1.5, -1.5, 0.1, 3, 10, 100, 1e308, -1e308, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER - 1, 2 ** 31, -(2 ** 31) - 1, 255, 256, -128, -129, 65535, 65536, 4294967295, 4294967296, '1', '', null, undefined, true, {}, [], 5n, -0];
add('number()', z => z.number(), NUMS);
add('number().int()', z => z.number().int(), NUMS);
add('int()', z => z.int(), NUMS);
add('number().positive()', z => z.number().positive(), NUMS);
add('number().negative()', z => z.number().negative(), NUMS);
add('number().nonnegative()', z => z.number().nonnegative(), NUMS);
add('number().nonpositive()', z => z.number().nonpositive(), NUMS);
add('number().gt(1)', z => z.number().gt(1), NUMS);
add('number().gte(1)', z => z.number().gte(1), NUMS);
add('number().lt(1)', z => z.number().lt(1), NUMS);
add('number().lte(1)', z => z.number().lte(1), NUMS);
add('number().min(-1).max(1)', z => z.number().min(-1).max(1), NUMS);
add('number().multipleOf(3)', z => z.number().multipleOf(3), NUMS);
add('number().multipleOf(0.1)', z => z.number().multipleOf(0.1), [0.3, 0.2, 1, 0.15, 0.1, 0.7, 1.1, 0.30000000000000004, 3, 0.05, -0.3]);
add('number().multipleOf(0.01)', z => z.number().multipleOf(0.01), [0.03, 0.005, 1.23, 1.234, 10, 0.1]);
add('number().step(5)', z => z.number().step(5), NUMS);
add('number().finite()', z => z.number().finite(), NUMS);
add('number().safe()', z => z.number().safe(), NUMS);
add('number().int().positive().max(10)', z => z.number().int().positive().max(10), NUMS);
add('int32()', z => z.int32(), NUMS);
add('uint32()', z => z.uint32(), NUMS);
add('float32()', z => z.float32(), NUMS);
add('float64()', z => z.float64(), NUMS);
add('nan()', z => z.nan(), NUMS);

const BIGS = [0n, 1n, -1n, 10n, 2n ** 64n, -(2n ** 63n), 2n ** 63n, 1, '1', null, undefined];
add('bigint()', z => z.bigint(), BIGS);
add('bigint().positive()', z => z.bigint().positive(), BIGS);
add('bigint().min(1n).max(10n)', z => z.bigint().min(1n).max(10n), BIGS);
add('int64()', z => z.int64(), BIGS);
add('uint64()', z => z.uint64(), BIGS);

// ---------------------------------------------------------------------------
// Primitives & literals
// ---------------------------------------------------------------------------
const PRIMS = [true, false, 0, 1, '', 'a', null, undefined, NaN, {}, [], new Date(0), Symbol.for('x'), 1n];
add('boolean()', z => z.boolean(), PRIMS);
add('null()', z => z.null(), PRIMS);
add('undefined()', z => z.undefined(), PRIMS);
add('void()', z => z.void(), PRIMS);
add('any()', z => z.any(), PRIMS);
add('unknown()', z => z.unknown(), PRIMS);
add('never()', z => z.never(), PRIMS);
add('symbol()', z => z.symbol(), PRIMS, false);
add('date()', z => z.date(), [new Date(0), new Date('2024-01-01'), new Date('x'), '2024-01-01', 1, null, undefined, {}]);
add('date().min(new Date(1000))', z => z.date().min(new Date(1000)), [new Date(0), new Date(1000), new Date(2000)]);
add('date().max(new Date(1000))', z => z.date().max(new Date(1000)), [new Date(0), new Date(1000), new Date(2000)]);
add("literal('a')", z => z.literal('a'), ['a', 'b', 'A', 0, null, undefined]);
add('literal(1)', z => z.literal(1), [1, '1', 1.0, 2, true]);
add('literal(true)', z => z.literal(true), [true, false, 'true', 1]);
add('literal(null)', z => z.literal(null), [null, undefined, 0, '']);
add("literal(['a', 'b'])", z => z.literal(['a', 'b']), ['a', 'b', 'c', null]);
add("enum(['a', 'b'])", z => z.enum(['a', 'b']), ['a', 'b', 'c', 'A', '', 0, null, undefined]);
add('nativeEnum', z => z.nativeEnum({ A: 'a', B: 1 } as const), ['a', 1, 'b', 'A', 'B', 2, null]);
add("enum().exclude(['a'])", z => z.enum(['a', 'b', 'c']).exclude(['a']), ['a', 'b', 'c']);
add("enum().extract(['a'])", z => z.enum(['a', 'b', 'c']).extract(['a']), ['a', 'b', 'c']);
add('stringbool()', z => z.stringbool(), ['true', 'false', 'yes', 'no', 'on', 'off', '1', '0', 'TRUE', 'False', 'y', 'n', 'enabled', 'disabled', '', 'maybe', true, false, 1, 0, null, undefined]);
add("templateLiteral(['id-', z.number()])", z => z.templateLiteral(['id-', z.number()]), ['id-1', 'id-12.5', 'id-', 'id-abc', 'xid-1', '1', 'id--1', 'id-1e5']);
add("templateLiteral([z.enum(['a','b']), '/', z.string()])", z => z.templateLiteral([z.enum(['a', 'b']), '/', z.string()]), ['a/x', 'b/', 'c/x', 'a', 'ab/x', 'a/x/y']);

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------
const OBJS = [
  { name: 'A', age: 1 }, { name: 'A', age: 1, extra: true }, { name: 'A' }, { age: 1 }, { name: 1, age: 'x' },
  {}, null, undefined, [], 'str', 42, { name: 'A', age: 1, nested: { deep: 1 } }, { name: 'A', age: 1.5 },
  { name: 'A', age: 1, tags: ['x', 'y'] }, { name: 'A', age: 1, tags: ['x', 1] }, { name: 'A', age: 1, tags: null },
  { name: 'A', age: 1, role: 'admin' }, { name: 'A', age: 1, role: 'root' }, { name: 'A', age: 1, role: undefined },
  { name: 'A', age: 1, count: undefined }, { name: 'A', age: 1, count: null }, { name: 'A', age: 1, count: 3 },
  new (class { name = 'A'; age = 1; })(),
];
add('object({ name, age })', z => z.object({ name: z.string(), age: z.number() }), OBJS);
add('object().strict()', z => z.object({ name: z.string(), age: z.number() }).strict(), OBJS);
add('strictObject()', z => z.strictObject({ name: z.string(), age: z.number() }), OBJS);
add('object().passthrough()', z => z.object({ name: z.string(), age: z.number() }).passthrough(), OBJS);
add('object().loose()', z => z.object({ name: z.string(), age: z.number() }).loose(), OBJS);
add('looseObject()', z => z.looseObject({ name: z.string(), age: z.number() }), OBJS);
add('object().strip()', z => z.object({ name: z.string(), age: z.number() }).strip(), OBJS);
add('object().catchall(z.boolean())', z => z.object({ name: z.string(), age: z.number() }).catchall(z.boolean()), OBJS);
add('object with optional', z => z.object({ name: z.string(), age: z.number(), tags: z.array(z.string()).optional() }), OBJS);
add('object with nullable', z => z.object({ name: z.string(), age: z.number(), tags: z.array(z.string()).nullable() }), OBJS);
add('object with nullish', z => z.object({ name: z.string(), age: z.number(), count: z.number().nullish() }), OBJS);
add('object with default', z => z.object({ name: z.string(), age: z.number(), count: z.number().default(7) }), OBJS);
add('object with default fn', z => z.object({ name: z.string(), age: z.number(), count: z.number().default(() => 9) }), OBJS);
add('object with catch', z => z.object({ name: z.string(), age: z.number(), count: z.number().catch(-1) }), OBJS);
add('object with enum', z => z.object({ name: z.string(), age: z.number(), role: z.enum(['admin', 'user']).optional() }), OBJS);
add('object with literal', z => z.object({ name: z.literal('A'), age: z.number() }), OBJS);
add('object with int', z => z.object({ name: z.string(), age: z.number().int() }), OBJS);
add('object with nested object', z => z.object({ name: z.string(), age: z.number(), nested: z.object({ deep: z.number() }).optional() }), OBJS);
add('object with undefined field', z => z.object({ name: z.string(), age: z.number(), count: z.undefined() }), OBJS);
add('object with unknown field', z => z.object({ name: z.string(), age: z.number(), count: z.unknown() }), OBJS);
add('object with any field', z => z.object({ name: z.string(), age: z.number(), count: z.any() }), OBJS);
add('object().partial()', z => z.object({ name: z.string(), age: z.number() }).partial(), OBJS);
add('object().required()', z => z.object({ name: z.string().optional(), age: z.number().optional() }).required(), OBJS);
add('object().pick({ name })', z => z.object({ name: z.string(), age: z.number() }).pick({ name: true }), OBJS);
add('object().omit({ age })', z => z.object({ name: z.string(), age: z.number() }).omit({ age: true }), OBJS);
add('object().extend({ role })', z => z.object({ name: z.string(), age: z.number() }).extend({ role: z.string() }), OBJS);
add('object().merge(other)', z => z.object({ name: z.string() }).merge(z.object({ age: z.number() })), OBJS);
add('object().keyof()', z => z.object({ name: z.string(), age: z.number() }).keyof(), ['name', 'age', 'x', 1]);
add('object with refine', z => z.object({ name: z.string(), age: z.number() }).refine(v => v.age > 0), OBJS);
add('object with transform', z => z.object({ name: z.string(), age: z.number() }).transform(v => v.name + v.age), OBJS);
add('object with readonly', z => z.object({ name: z.string(), age: z.number() }).readonly(), OBJS);
add('object().optional()', z => z.object({ name: z.string(), age: z.number() }).optional(), OBJS);
add('object().nullable()', z => z.object({ name: z.string(), age: z.number() }).nullable(), OBJS);
add('object().default({})', z => z.object({ name: z.string(), age: z.number() }).default({ name: 'd', age: 0 }), OBJS);
add('object with string formats', z => z.object({ name: z.string().email(), age: z.number().int().min(0) }), [{ name: 'a@b.co', age: 1 }, { name: 'nope', age: 1 }, { name: 'a@b.co', age: -1 }, { name: 'a@b.co', age: 1.5 }]);
add('object with coerce', z => z.object({ n: z.coerce.number(), b: z.coerce.boolean(), s: z.coerce.string() }), [{ n: '1', b: 'false', s: 5 }, { n: 'x', b: 0, s: null }, { n: '', b: '', s: undefined }, { n: null, b: null, s: {} }]);
add('object with deepPartial', z => z.object({ name: z.string(), nested: z.object({ deep: z.number() }) }).partial(), [{ }, { nested: {} }, { nested: { deep: 1 } }, { name: 'a' }]);

// ---------------------------------------------------------------------------
// Arrays, tuples, records, maps, sets
// ---------------------------------------------------------------------------
const ARRS = [[], ['a'], ['a', 'b'], ['a', 1], [1, 2, 3], [1, 'x'], [NaN], [Infinity], [null], [undefined], 'a', null, undefined, {}, [[1]], [{}], [[]], ['a', 'b', 'c', 'd']];
add('array(string())', z => z.array(z.string()), ARRS);
add('array(number())', z => z.array(z.number()), ARRS);
add('string().array()', z => z.string().array(), ARRS);
add('array().min(1)', z => z.array(z.string()).min(1), ARRS);
add('array().max(2)', z => z.array(z.string()).max(2), ARRS);
add('array().length(2)', z => z.array(z.string()).length(2), ARRS);
add('array().nonempty()', z => z.array(z.string()).nonempty(), ARRS);
add('array(array(number()))', z => z.array(z.array(z.number())), ARRS);
add('array(object)', z => z.array(z.object({ a: z.number().optional() })), ARRS);
add('array(union)', z => z.array(z.union([z.string(), z.number()])), ARRS);
add('array(string().min(1))', z => z.array(z.string().min(1)), [['a'], [''], ['a', ''], []]);
add('tuple([string, number])', z => z.tuple([z.string(), z.number()]), [['a', 1], ['a'], ['a', 1, 2], [1, 'a'], [], 'a', null, ['a', 1.5]]);
add('tuple().rest(boolean)', z => z.tuple([z.string()]).rest(z.boolean()), [['a'], ['a', true], ['a', true, false], ['a', 1], [], [true]]);
add('tuple with optional', z => z.tuple([z.string(), z.number().optional()]), [['a'], ['a', 1], ['a', undefined], ['a', 'b'], [], ['a', 1, 2]]);
add('record(string, number)', z => z.record(z.string(), z.number()), [{}, { a: 1 }, { a: 'x' }, { a: 1, b: 2 }, [], null, 'x', { a: NaN }, { a: undefined }]);
add("record(enum(['a','b']), number)", z => z.record(z.enum(['a', 'b']), z.number()), [{ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2, c: 3 }, {}]);
add("partialRecord(enum(['a','b']), number)", z => z.partialRecord(z.enum(['a', 'b']), z.number()), [{ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2, c: 3 }, {}]);
add('record(string().min(2), number)', z => z.record(z.string().min(2), z.number()), [{ ab: 1 }, { a: 1 }, {}]);
add('map(string, number)', z => z.map(z.string(), z.number()), [new Map(), new Map([['a', 1]]), new Map([['a', 'x']]), new Map([[1, 1]]), {}, [], null]);
add('set(number)', z => z.set(z.number()), [new Set(), new Set([1, 2]), new Set(['a']), new Set([1, 'a']), [], {}, null]);
add('set().min(1)', z => z.set(z.number()).min(1), [new Set(), new Set([1])]);
add('set().max(1)', z => z.set(z.number()).max(1), [new Set(), new Set([1]), new Set([1, 2])]);

// ---------------------------------------------------------------------------
// Unions, intersections, wrappers, effects
// ---------------------------------------------------------------------------
const MIXED = ['a', 1, true, null, undefined, {}, [], { type: 'a', a: 1 }, { type: 'b', b: 'x' }, { type: 'c' }, { type: 'a', a: 'x' }, { type: 'a' }, NaN, 1.5, '', 0];
add('union([string, number])', z => z.union([z.string(), z.number()]), MIXED);
add('string().or(number())', z => z.string().or(z.number()), MIXED);
add('union([literal, literal])', z => z.union([z.literal('a'), z.literal(1)]), MIXED);
add('union([object, object])', z => z.union([z.object({ type: z.literal('a'), a: z.number() }), z.object({ type: z.literal('b'), b: z.string() })]), MIXED);
add('union with optional', z => z.union([z.string(), z.number().optional()]), MIXED);
add('union with transform', z => z.union([z.string().transform(s => s.length), z.number()]), MIXED);
add("discriminatedUnion('type')", z => z.discriminatedUnion('type', [z.object({ type: z.literal('a'), a: z.number() }), z.object({ type: z.literal('b'), b: z.string() })]), MIXED);
add('intersection(object, object)', z => z.intersection(z.object({ a: z.number() }), z.object({ b: z.string() })), [{ a: 1, b: 'x' }, { a: 1 }, { b: 'x' }, {}, null, { a: 1, b: 'x', c: 2 }]);
add('object.and(object)', z => z.object({ a: z.number() }).and(z.object({ b: z.string() })), [{ a: 1, b: 'x' }, { a: 1 }, { a: 1, b: 'x', c: 2 }]);
add('intersection(string, string().min(2))', z => z.intersection(z.string(), z.string().min(2)), ['a', 'ab', 1]);
add('string().optional()', z => z.string().optional(), MIXED);
add('optional(string())', z => z.optional(z.string()), MIXED);
add('string().nullable()', z => z.string().nullable(), MIXED);
add('string().nullish()', z => z.string().nullish(), MIXED);
add("string().default('d')", z => z.string().default('d'), MIXED);
add('number().default(() => 3)', z => z.number().default(() => 3), MIXED);
add("string().catch('c')", z => z.string().catch('c'), MIXED);
add('number().catch(() => 0)', z => z.number().catch(() => 0), MIXED);
add('string().transform(len)', z => z.string().transform(s => s.length), MIXED);
add('string().transform(len).pipe(number().min(2))', z => z.string().transform(s => s.length).pipe(z.number().min(2)), ['a', 'ab', 'abc', 1]);
add('string().pipe(string().min(2))', z => z.string().pipe(z.string().min(2)), ['a', 'ab', 1]);
add('number().refine(even)', z => z.number().refine(n => n % 2 === 0), NUMS);
add('string().refine(len>1).refine(len<4)', z => z.string().refine(s => s.length > 1).refine(s => s.length < 4), STRS);
add('string().superRefine', z => z.string().superRefine((s, ctx) => { if (s.length < 2) ctx.addIssue({ code: 'custom', message: 'short' }); }), STRS);
add('string().check(...)', z => z.string().check((ctx: any) => { if (ctx.value.length < 2) ctx.issues?.push?.({ code: 'custom', message: 'short', input: ctx.value }); }), STRS, false);
add('preprocess(String, string().min(1))', z => z.preprocess(v => String(v), z.string().min(1)), MIXED);
add('preprocess(Number, number())', z => z.preprocess(v => Number(v), z.number()), ['1', '1.5', 'x', 1, null, undefined, true, '']);
add('string().readonly()', z => z.string().readonly(), MIXED);
add('array(string()).readonly()', z => z.array(z.string()).readonly(), ARRS);
add('lazy(() => string())', z => z.lazy(() => z.string()), MIXED);
add('recursive lazy tree', z => { const Tree: any = z.lazy(() => z.object({ v: z.number(), kids: z.array(Tree).optional() })); return Tree; }, [{ v: 1 }, { v: 1, kids: [{ v: 2 }, { v: 3, kids: [] }] }, { v: 1, kids: [{ v: 'x' }] }, { v: 1, kids: [{ v: 2, kids: [{ v: 3, kids: [{ kids: [] }] }] }] }, {}, null]);
add('custom(isEven)', z => z.custom<number>(v => typeof v === 'number' && v % 2 === 0), NUMS);
add('instanceof(Date)', z => z.instanceof(Date), [new Date(), new Date('x'), '2024', {}, null]);
add('success(string())', z => z.success(z.string()), MIXED);
add('json()', z => z.json(), [1, 'a', true, null, [1, 'a', [true]], { a: { b: [1, null] } }, undefined, { a: undefined }, [undefined], NaN, () => {}, new Date(), 1n]);
add('nonoptional', z => z.string().optional().nonoptional(), ['a', undefined, null]);
add('exactOptional in object', z => z.object({ a: z.string().exactOptional() }), [{}, { a: 'x' }, { a: undefined }]);
add('coerce.string()', z => z.coerce.string(), [1, 'a', true, null, undefined, {}, [], 1.5, 0, NaN]);
add('coerce.number()', z => z.coerce.number(), ['1', '1.5', 'x', '', ' 2 ', null, undefined, true, false, [], {}, [1], '0x10', '1e3', Infinity]);
add('coerce.boolean()', z => z.coerce.boolean(), ['true', 'false', '', 0, 1, null, undefined, {}, [], 'no']);
add('coerce.bigint()', z => z.coerce.bigint(), ['1', 1, 1.5, 'x', true, null, undefined, 10n]);
add('coerce.date()', z => z.coerce.date(), ['2024-01-01', 0, 'x', null, undefined, new Date(0), true, {}]);
add('coerce.number().int().min(1)', z => z.coerce.number().int().min(1), ['1', '0', '1.5', 'x', 3]);
add('coerce.string().email()', z => z.coerce.string().email(), ['a@b.co', 1, null]);
add('coerce.string().min(2)', z => z.coerce.string().min(2), [1, 12, 'a', 'ab', null]);
add('object().brand()', z => z.object({ a: z.number() }).brand<'B'>(), [{ a: 1 }, { a: 'x' }]);
add('promise-free async safeParse compat', z => z.number(), [1, 'a']);

// Immutability: specialising a schema must not mutate the base (Zod semantics)
add('shared base schema stays untouched', z => { const base = z.string(); base.min(3); base.email(); return base; }, STRS);
add('specialised copy has the check', z => { const base = z.string(); return base.min(3); }, STRS);
add('number base stays untouched', z => { const base = z.number(); base.int().positive(); return base; }, NUMS);
add('array base stays untouched', z => { const base = z.array(z.string()); base.min(1); return base; }, ARRS);

// Standalone checks via .check(...)
add('string().check(z.minLength(2), z.maxLength(4))', z => z.string().check(z.minLength(2), z.maxLength(4)), STRS);
add('string().check(z.length(3))', z => z.string().check(z.length(3)), STRS);
add("string().check(z.regex(/^h/), z.includes('lo'))", z => z.string().check(z.regex(/^h/), z.includes('lo')), STRS);
add("string().check(z.startsWith('he'), z.endsWith('lo'))", z => z.string().check(z.startsWith('he'), z.endsWith('lo')), STRS);
add('string().check(z.trim(), z.toLowerCase())', z => z.string().check(z.trim(), z.toLowerCase()), STRS);
add('string().check(z.overwrite(s => s + "!"))', z => z.string().check(z.overwrite((s: string) => s + '!')), STRS);
add('number().check(z.gt(1), z.lte(10))', z => z.number().check(z.gt(1), z.lte(10)), NUMS);
add('number().check(z.positive(), z.multipleOf(2))', z => z.number().check(z.positive(), z.multipleOf(2)), NUMS);
add('number().check(z.nonnegative())', z => z.number().check(z.nonnegative()), NUMS);
add('array(number()).check(z.minLength(1))', z => z.array(z.number()).check(z.minLength(1)), ARRS);
add('set(number()).check(z.minSize(1), z.maxSize(2))', z => z.set(z.number()).check(z.minSize(1), z.maxSize(2)), [new Set(), new Set([1]), new Set([1, 2]), new Set([1, 2, 3])]);
add('string().check(z.refine(s => s.length > 1))', z => z.string().check(z.refine((s: string) => s.length > 1)), STRS);
add('object().check(z.property("a", z.string().min(2)))', z => z.object({ a: z.string() }).check(z.property('a', z.string().min(2))), [{ a: 'x' }, { a: 'xy' }, { a: 1 }]);
add('string().check(payload fn)', z => z.string().check((ctx: any) => { if (ctx.value.length < 2) ctx.issues.push({ code: 'custom', message: 'short', input: ctx.value }); }), STRS);

// ---------------------------------------------------------------------------
// Zod 4 API surface added in 1.7.0
// ---------------------------------------------------------------------------
const NUMSTRS = ['42', '0', '-1', '3.5', 'x', '', ' 7 ', 'Infinity', null, undefined, 42];
const strToNum = (z: any) => z.codec(z.string(), z.number(), { decode: (s: string) => Number(s), encode: (n: number) => String(n) });
add('codec(string -> number)', z => strToNum(z), NUMSTRS);
add('codec inside object', z => z.object({ n: strToNum(z) }), [{ n: '1' }, { n: 'x' }, { n: 1 }, {}]);
add('codec inside array', z => z.array(strToNum(z)), [['1', '2'], ['x'], [], [1]]);
add('codec().optional()', z => strToNum(z).optional(), NUMSTRS);

add('prefault(valid)', z => z.string().transform((s: string) => s.length).prefault('abc'), ['ab', undefined, 1]);
add('prefault(invalid)', z => z.string().min(5).prefault('ab'), ['abcdef', undefined, 'abc']);
add('prefault(fn)', z => z.string().transform((s: string) => s.length).prefault(() => 'abcd'), [undefined, 'ab']);

add('transform with ctx.addIssue', z => z.string().transform((s: string, ctx: any) => {
  if (s.length < 2) { ctx.addIssue({ code: 'custom', message: 'short' }); return z.NEVER; }
  return s.length;
}), STRS);
add('transform ctx.addIssue(string)', z => z.string().transform((s: string, ctx: any) => {
  if (s.length < 2) ctx.addIssue('short');
  return s;
}), STRS);

add('refine({ when })', z => z.string().refine((s: string) => s.length > 3, { when: (p: any) => p.value.startsWith('h') }), STRS);
add('refine({ abort })', z => z.string().refine((s: string) => s.length > 3, { abort: true }), STRS);
add('catch(ctx)', z => z.number().catch((ctx: any) => ctx.issues.length), MIXED);

add('tuple(items, rest)', z => z.tuple([z.string()], z.number()), [['a'], ['a', 1], ['a', 1, 2], ['a', 'b'], [], [1]]);
add('map().min(1)', z => z.map(z.string(), z.number()).min(1), [new Map(), new Map([['a', 1]]), new Map([['a', 1], ['b', 2]])]);
add('map().max(1)', z => z.map(z.string(), z.number()).max(1), [new Map(), new Map([['a', 1]]), new Map([['a', 1], ['b', 2]])]);
add('map().size(1)', z => z.map(z.string(), z.number()).size(1), [new Map(), new Map([['a', 1]]), new Map([['a', 1], ['b', 2]])]);
add('map().nonempty()', z => z.map(z.string(), z.number()).nonempty(), [new Map(), new Map([['a', 1]])]);

add('xor([string, number])', z => z.xor([z.string(), z.number()]), MIXED);
add('xor with overlap', z => z.xor([z.string(), z.string().min(2)]), STRS);
add('stringFormat(regex)', z => z.stringFormat('hexish', /^[0-9a-f]+$/), ['abc', 'ABC', '0f', 'z', '', 1, null]);
add('stringFormat(fn)', z => z.stringFormat('short', (s: string) => s.length < 3), STRS);
add('string().slugify()', z => z.string().slugify(), ['  Hello World! ', 'a_b-c', 'héllo wörld', '', '---', 'Already-Slug']);

add('discriminatedUnion with optional discriminator', z => z.discriminatedUnion('k', [
  z.object({ k: z.literal('a').optional(), x: z.string().optional() }),
  z.object({ k: z.literal('b'), y: z.number() }),
]), [{}, { k: 'a' }, { k: 'b', y: 1 }, { k: 'b' }, { k: 'c' }, null]);
add('discriminatedUnion with enum discriminator', z => z.discriminatedUnion('k', [
  z.object({ k: z.enum(['a', 'b']), x: z.string() }),
  z.object({ k: z.literal('c') }),
]), [{ k: 'a', x: 'v' }, { k: 'b', x: 'v' }, { k: 'c' }, { k: 'd' }, {}]);

add('strictObject().extend() stays strict', z => z.strictObject({ a: z.string() }).extend({ b: z.number() }), [{ a: 'x', b: 1 }, { a: 'x', b: 1, c: 2 }]);
add('object().catchall().extend() keeps catchall', z => z.object({ a: z.string() }).catchall(z.number()).extend({ b: z.number() }), [{ a: 'x', b: 1 }, { a: 'x', b: 1, c: 2 }, { a: 'x', b: 1, c: 'z' }]);
add('strictObject().pick() stays strict', z => z.strictObject({ a: z.string(), b: z.number() }).pick({ a: true }), [{ a: 'x' }, { a: 'x', c: 1 }]);
add('object().safeExtend()', z => z.object({ a: z.string() }).safeExtend({ b: z.number() }), [{ a: 'x', b: 1 }, { a: 'x' }]);

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
function ser(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (typeof val === 'bigint') return `${val}n`;
    if (typeof val === 'number' && !Number.isFinite(val)) return String(val);
    if (typeof val === 'symbol') return val.toString();
    if (typeof val === 'function') return '[fn]';
    if (val instanceof Map) return { __map: [...val.entries()] };
    if (val instanceof Set) return { __set: [...val.values()] };
    if (val === undefined) return '__undefined__';
    if (typeof val === 'number' && Object.is(val, -0)) return '-0';
    return val;
  });
}

function show(v: unknown): string {
  try {
    const s = ser(v);
    return s === undefined ? String(v) : s.length > 60 ? s.slice(0, 57) + '...' : s;
  } catch {
    return String(v);
  }
}

let checks = 0;
const failures: string[] = [];

for (const c of cases) {
  let zs: any, ds: any;
  try {
    zs = c.build(zod);
  } catch (e: any) {
    failures.push(`${c.name}: zod build threw ${e?.message ?? e}`);
    continue;
  }
  try {
    ds = c.build(dhi);
  } catch (e: any) {
    failures.push(`${c.name}: dhi build threw ${e?.message ?? e}`);
    continue;
  }
  for (const input of c.inputs) {
    checks++;
    let zr: any, dr: any;
    try {
      zr = zs.safeParse(input);
    } catch (e: any) {
      zr = { success: false, threw: e?.message ?? String(e) };
    }
    try {
      dr = ds.safeParse(input);
    } catch (e: any) {
      failures.push(`${c.name} :: ${show(input)} -> dhi threw: ${e?.message ?? e}`);
      continue;
    }
    if (!!zr.success !== !!dr.success) {
      failures.push(`${c.name} :: ${show(input)} -> zod ${zr.success ? 'accepts' : 'rejects'}, dhi ${dr.success ? 'accepts' : 'rejects'}`);
      continue;
    }
    if (zr.success && c.compareData !== false) {
      const a = ser(zr.data);
      const b = ser(dr.data);
      if (a !== b) failures.push(`${c.name} :: ${show(input)} -> data differs: zod ${show(zr.data)} vs dhi ${show(dr.data)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Async parse parity: the same schema with async refinements / transforms
// ---------------------------------------------------------------------------
const asyncCases: Case[] = [];
const addAsync = (name: string, build: (z: any) => any, inputs: unknown[], compareData = true) =>
  asyncCases.push({ name, build, inputs, compareData });

addAsync('async refine', z => z.string().refine(async (s: string) => s.length > 2), STRS);
addAsync('async refine in object', z => z.object({ a: z.string().refine(async (s: string) => s.length > 2) }), [{ a: 'abc' }, { a: 'a' }, { a: 1 }, {}]);
addAsync('async refine in array', z => z.array(z.string().refine(async (s: string) => s.length > 2)), [['abc'], ['a'], [], ['abc', 'z']]);
addAsync('async transform', z => z.string().transform(async (s: string) => s.length), STRS);
addAsync('async transform in object', z => z.object({ a: z.string().transform(async (s: string) => s.length) }), [{ a: 'abc' }, { a: 1 }]);
addAsync('async transform then pipe', z => z.string().transform(async (s: string) => s.length).pipe(z.number().min(2)), STRS);
addAsync('async superRefine', z => z.string().superRefine(async (s: string, ctx: any) => {
  if (s.length < 2) ctx.addIssue({ code: 'custom', message: 'short' });
}), STRS);
addAsync('async refine in union', z => z.union([z.string().refine(async (s: string) => s.length > 2), z.number()]), MIXED);
addAsync('async refine under optional', z => z.string().refine(async (s: string) => s.length > 2).optional(), MIXED);
addAsync('async refine in tuple', z => z.tuple([z.string().refine(async (s: string) => s.length > 2)]), [['abc'], ['a'], []]);
addAsync('async refine in record', z => z.record(z.string(), z.string().refine(async (s: string) => s.length > 2)), [{ k: 'abc' }, { k: 'a' }, {}]);
addAsync('sync schema through parseAsync', z => z.object({ a: z.string(), b: z.number().int() }), [{ a: 'x', b: 1 }, { a: 'x', b: 1.5 }, null]);

for (const c of asyncCases) {
  const zs = c.build(zod);
  const ds = c.build(dhi);
  for (const input of c.inputs) {
    checks++;
    let zr: any, dr: any;
    try {
      zr = await zs.safeParseAsync(input);
    } catch (e: any) {
      zr = { success: false, threw: e?.message ?? String(e) };
    }
    try {
      dr = await ds.safeParseAsync(input);
    } catch (e: any) {
      failures.push(`async ${c.name} :: ${show(input)} -> dhi threw: ${e?.message ?? e}`);
      continue;
    }
    if (!!zr.success !== !!dr.success) {
      failures.push(`async ${c.name} :: ${show(input)} -> zod ${zr.success ? 'accepts' : 'rejects'}, dhi ${dr.success ? 'accepts' : 'rejects'}`);
      continue;
    }
    if (zr.success && c.compareData !== false) {
      const a = ser(zr.data);
      const b = ser(dr.data);
      if (a !== b) failures.push(`async ${c.name} :: ${show(input)} -> data differs: zod ${show(zr.data)} vs dhi ${show(dr.data)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Encode parity (`z.safeEncode`): codecs run backwards, transforms refuse
// ---------------------------------------------------------------------------
const encodeCases: Array<[string, (z: any) => any, unknown[]]> = [
  ['codec(string -> number)', z => strToNum(z), [1, 0, -3, 1.5, 'x', null, undefined]],
  ['codec inside object', z => z.object({ n: strToNum(z) }), [{ n: 1 }, { n: 'x' }, {}]],
  ['codec inside array', z => z.array(strToNum(z)), [[1, 2], ['x'], []]],
  ['codec optional', z => strToNum(z).optional(), [1, undefined, 'x']],
  ['plain string', z => z.string(), ['a', 1, null]],
  ['object of primitives', z => z.object({ a: z.string(), b: z.number() }), [{ a: 'x', b: 1 }, { a: 1, b: 1 }]],
  ['stringbool', z => z.stringbool(), [true, false, 'true', 1]],
  ['pipe of validators', z => z.string().pipe(z.string().min(2)), ['ab', 'a', 1]],
];
for (const [name, build, inputs] of encodeCases) {
  const zs = build(zod);
  const ds = build(dhi);
  for (const input of inputs) {
    checks++;
    let zr: any, dr: any;
    try {
      zr = zod.safeEncode(zs, input);
    } catch (e: any) {
      zr = { success: false, threw: true };
    }
    try {
      dr = dhi.safeEncode(ds, input);
    } catch (e: any) {
      dr = { success: false, threw: true };
    }
    if (!!zr.success !== !!dr.success) {
      failures.push(`encode ${name} :: ${show(input)} -> zod ${zr.success ? 'accepts' : 'rejects'}, dhi ${dr.success ? 'accepts' : 'rejects'}`);
      continue;
    }
    if (zr.success && ser(zr.data) !== ser(dr.data)) {
      failures.push(`encode ${name} :: ${show(input)} -> data differs: zod ${show(zr.data)} vs dhi ${show(dr.data)}`);
    }
  }
}

// A one-way `.transform()` must refuse to encode in both libraries
checks++;
{
  const zThrew = (() => { try { zod.encode(zod.string().transform((s: string) => s.length), 3); return false; } catch { return true; } })();
  const dThrew = (() => { try { dhi.encode(dhi.string().transform((s: string) => s.length), 3); return false; } catch { return true; } })();
  if (zThrew !== dThrew) failures.push(`encode through transform: zod ${zThrew ? 'throws' : 'succeeds'}, dhi ${dThrew ? 'throws' : 'succeeds'}`);
}

// ---------------------------------------------------------------------------
// Issue-code parity: dhi emits Zod 4 codes (messages are dhi's own wording)
// ---------------------------------------------------------------------------
const codeCases: Array<[string, (z: any) => any, unknown[]]> = [
  ['string type', z => z.string(), [1, null, undefined, true, {}]],
  ['string min/max/length', z => z.string().min(3).max(5), ['a', 'abcdef', 'abcd']],
  ['string formats', z => z.string().email(), ['x', 'a@b.co']],
  ['string regex', z => z.string().regex(/^a/), ['b']],
  ['string startsWith', z => z.string().startsWith('a'), ['b']],
  ['number min', z => z.number().min(3), [1, 4]],
  ['number multipleOf', z => z.number().multipleOf(2), [5, 4]],
  ['number int', z => z.number().int(), [1.5]],
  ['enum', z => z.enum(['a', 'b']), ['c', 1]],
  ['literal', z => z.literal('a'), ['b']],
  ['literal multi', z => z.literal(['a', 'b']), ['c']],
  ['date', z => z.date(), ['x', new Date('nope')]],
  ['array min', z => z.array(z.string()).min(2), [['a']]],
  ['array element', z => z.array(z.string()), [[1], ['a', 2]]],
  ['unrecognized keys', z => z.strictObject({ a: z.string() }), [{ a: 'x', b: 1 }]],
  ['union', z => z.union([z.string(), z.number()]), [true]],
  ['custom refine', z => z.string().refine(() => false), ['a']],
  ['bigint', z => z.bigint(), [1]],
  ['set min', z => z.set(z.string()).min(2), [new Set(['a'])]],
  ['file', z => z.file(), ['x']],
  ['nested object', z => z.object({ a: z.object({ b: z.number() }) }), [{ a: { b: 'x' } }]],
];
for (const [name, build, inputs] of codeCases) {
  const zs = build(zod);
  const ds = build(dhi);
  for (const input of inputs) {
    checks++;
    const zr = zs.safeParse(input);
    const dr = ds.safeParse(input);
    if (zr.success || dr.success) continue;
    const zc = JSON.stringify(zr.error.issues.map((i: any) => [i.code, i.path]));
    const dc = JSON.stringify(dr.error.issues.map((i: any) => [i.code, i.path]));
    if (zc !== dc) failures.push(`issue codes ${name} :: ${show(input)} -> zod ${zc} vs dhi ${dc}`);
  }
}

// JSON Schema parity for object required-ness (io: input vs output), like the MCP SDK relies on
const jsonCases: Array<[string, (z: any) => any]> = [
  ['plain', z => z.object({ a: z.string(), b: z.number().optional(), c: z.number().default(1), d: z.string().nullable(), e: z.string().nullish(), f: z.number().catch(0), h: z.unknown(), i: z.any(), j: z.string().exactOptional() })],
  ['nested', z => z.object({ o: z.object({ x: z.string().optional() }), arr: z.array(z.object({ y: z.number().default(2) })) })],
  ['union optional', z => z.object({ v: z.union([z.string(), z.number().optional()]), w: z.union([z.string(), z.number()]) })],
  ['pipe', z => z.object({ p: z.string().optional().pipe(z.string().default('x')), q: z.string().default('a').pipe(z.string()) })],
];
for (const [name, build] of jsonCases) {
  for (const io of ['input', 'output'] as const) {
    checks++;
    let zj: any, dj: any;
    try {
      zj = zod.toJSONSchema(build(zod), { io });
      dj = dhi.toJSONSchema(build(dhi), { io });
    } catch (e: any) {
      failures.push(`toJSONSchema ${name} (${io}) threw: ${e?.message ?? e}`);
      continue;
    }
    const zr = JSON.stringify([...(zj.required ?? [])].sort());
    const dr = JSON.stringify([...(dj.required ?? [])].sort());
    if (zr !== dr) failures.push(`toJSONSchema ${name} (${io}) required differs: zod ${zr} vs dhi ${dr}`);
    const zk = JSON.stringify(Object.keys(zj.properties ?? {}).sort());
    const dk = JSON.stringify(Object.keys(dj.properties ?? {}).sort());
    if (zk !== dk) failures.push(`toJSONSchema ${name} (${io}) property keys differ: zod ${zk} vs dhi ${dk}`);
    if (zj.$schema !== dj.$schema) failures.push(`toJSONSchema ${name} (${io}) $schema differs: zod ${zj.$schema} vs dhi ${dj.$schema}`);
    const za = JSON.stringify(zj.additionalProperties);
    const da = JSON.stringify(dj.additionalProperties);
    if (za !== da) failures.push(`toJSONSchema ${name} (${io}) additionalProperties differ: zod ${za} vs dhi ${da}`);
  }
}

// Unknown-key policy in the emitted JSON Schema, per object mode and direction
for (const [name, build] of [
  ['strip', (z: any) => z.object({ a: z.string() })],
  ['strict', (z: any) => z.strictObject({ a: z.string() })],
  ['loose', (z: any) => z.looseObject({ a: z.string() })],
  ['catchall', (z: any) => z.object({ a: z.string() }).catchall(z.number())],
] as Array<[string, (z: any) => any]>) {
  for (const io of ['input', 'output'] as const) {
    for (const target of ['draft-2020-12', 'draft-7', 'openapi-3.0'] as const) {
      checks++;
      const zj = zod.toJSONSchema(build(zod), { io, target } as any);
      const dj = dhi.toJSONSchema(build(dhi), { io, target });
      if (JSON.stringify(zj.additionalProperties) !== JSON.stringify(dj.additionalProperties)) {
        failures.push(`toJSONSchema unknown keys ${name} (${io}/${target}): zod ${JSON.stringify(zj.additionalProperties)} vs dhi ${JSON.stringify(dj.additionalProperties)}`);
      }
      if (zj.$schema !== dj.$schema) {
        failures.push(`toJSONSchema $schema ${name} (${io}/${target}): zod ${zj.$schema} vs dhi ${dj.$schema}`);
      }
    }
  }
}

console.log(`Zod 4 parity: ${cases.length} schemas, ${checks} checks, ${failures.length} mismatches`);
for (const f of failures) console.log(`  ✗ ${f}`);
if (failures.length > 0) process.exit(1);
console.log('  ✓ dhi and zod agree on every input');
