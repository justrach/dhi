const std = @import("std");
const validators = @import("validators_comprehensive.zig");

// =============================================================================
// Proxy-WASM ABI: Host imports (provided by Envoy)
// =============================================================================

extern fn proxy_log(level: u32, msg_ptr: [*]const u8, msg_size: usize) void;
extern fn proxy_get_buffer_bytes(
    buffer_type: u32,
    start: usize,
    length: usize,
    out_ptr: [*]u8,
    out_size: usize,
) u32;
extern fn proxy_get_header_map_value(
    map_type: u32,
    key_ptr: [*]const u8,
    key_size: usize,
    value_ptr: [*]u8,
    value_size: usize,
) u32;
extern fn proxy_set_header_map_value(
    map_type: u32,
    key_ptr: [*]const u8,
    key_size: usize,
    value_ptr: [*]const u8,
    value_size: usize,
) void;
extern fn proxy_send_local_response(
    status_code: u32,
    body_ptr: [*]const u8,
    body_size: usize,
    headers_ptr: [*]const u8,
    headers_size: usize,
    grpc_status: u32,
) void;

// =============================================================================
// Constants
// =============================================================================

const LOG_TRACE: u32 = 0;
const LOG_DEBUG: u32 = 1;
const LOG_INFO: u32 = 2;
const LOG_WARN: u32 = 3;
const LOG_ERROR: u32 = 4;
const LOG_CRITICAL: u32 = 5;

const ACTION_CONTINUE: u32 = 0;
const ACTION_PAUSE: u32 = 1;

const MAP_REQUEST_HEADERS: u32 = 0;
const MAP_REQUEST_TRAILERS: u32 = 3;

const BUFFER_REQUEST_BODY: u32 = 4;
const BUFFER_RESPONSE_BODY: u32 = 5;

const HTTP_STATUS_OK: u32 = 200;
const HTTP_STATUS_BAD_REQUEST: u32 = 400;

const CONTENT_TYPE_JSON = "application/json";

// =============================================================================
// Configuration types
// =============================================================================

const FieldType = enum(u8) {
    email = 0,
    uuid = 1,
    ipv4 = 2,
    url = 3,
    string_length = 4,
    int_range = 5,
    required_present = 6,
};

const FieldRule = struct {
    field_name: []const u8,
    field_type: FieldType,
    min: i64,
    max: i64,
};

const FilterConfig = struct {
    validators: []const FieldRule,
};

var config: FilterConfig = .{ .validators = &.{} };

fn log(level: u32, msg: []const u8) void {
    proxy_log(level, msg.ptr, msg.len);
}

// =============================================================================
// Simple JSON field extraction (no allocator, no recursion, u64 hashes)
// =============================================================================

fn hashFieldName(name: []const u8) u64 {
    var h: u64 = 14695981039346656037;
    for (name) |c| {
        h ^= @as(u64, c);
        h *%= 1099511628211;
    }
    return h;
}

fn extractStringField(json: []const u8, field_hash: u64) ?[]const u8 {
    var i: usize = 0;
    while (i < json.len) {
        if (json[i] == '"') {
            const key_start = i + 1;
            i += 1;
            while (i < json.len and json[i] != '"') {
                if (json[i] == '\\') i += 1;
                i += 1;
            }
            if (i >= json.len) return null;
            const key = json[key_start..i];

            if (hashFieldName(key) != field_hash) {
                i += 1;
                continue;
            }

            i += 1;
            while (i < json.len and (json[i] == ':' or json[i] == ' ')) i += 1;
            if (i >= json.len) return null;

            if (json[i] == '"') {
                const val_start = i + 1;
                i += 1;
                while (i < json.len and json[i] != '"') {
                    if (json[i] == '\\') i += 1;
                    i += 1;
                }
                return json[val_start..i];
            }
            return null;
        }
        i += 1;
    }
    return null;
}

fn extractIntField(json: []const u8, field_hash: u64) ?i64 {
    var i: usize = 0;
    while (i < json.len) {
        if (json[i] == '"') {
            const key_start = i + 1;
            i += 1;
            while (i < json.len and json[i] != '"') {
                if (json[i] == '\\') i += 1;
                i += 1;
            }
            if (i >= json.len) return null;
            const key = json[key_start..i];

            if (hashFieldName(key) != field_hash) {
                i += 1;
                continue;
            }

            i += 1;
            while (i < json.len and (json[i] == ':' or json[i] == ' ')) i += 1;
            if (i >= json.len) return null;

            if (json[i] == '-' or (json[i] >= '0' and json[i] <= '9')) {
                const val_start = i;
                if (json[i] == '-') i += 1;
                while (i < json.len and json[i] >= '0' and json[i] <= '9') i += 1;
                return std.fmt.parseInt(i64, json[val_start..i], 10) catch null;
            }
            return null;
        }
        i += 1;
    }
    return null;
}

fn extractStringLen(json: []const u8, field_hash: u64) ?usize {
    const s = extractStringField(json, field_hash) orelse return null;
    return s.len;
}

fn fieldExists(json: []const u8, field_hash: u64) bool {
    return extractStringField(json, field_hash) != null or extractIntField(json, field_hash) != null;
}

// =============================================================================
// Validation logic
// =============================================================================

fn validateFieldValue(value: []const u8, rule: FieldRule) bool {
    return switch (rule.field_type) {
        .email => validators.validateEmail(value),
        .uuid => validators.validateUuid(value),
        .ipv4 => validators.validateIpv4(value),
        .url => validators.validateUrl(value),
        .string_length => {
            const len = value.len;
            const min = @as(usize, @intCast(@max(rule.min, 0)));
            const max = @as(usize, @intCast(@max(rule.max, 0)));
            return len >= min and len <= max;
        },
        .int_range => {
            const val = std.fmt.parseInt(i64, value, 10) catch return false;
            return val >= rule.min and val <= rule.max;
        },
        .required_present => value.len > 0,
    };
}

fn validateBody(body: []const u8, cfg: FilterConfig) bool {
    for (cfg.validators) |rule| {
        const fh = hashFieldName(rule.field_name);
        switch (rule.field_type) {
            .int_range => {
                const val = extractIntField(body, fh) orelse return false;
                if (val < rule.min or val > rule.max) return false;
            },
            .string_length => {
                const len = extractStringLen(body, fh) orelse return false;
                const min = @as(usize, @intCast(@max(rule.min, 0)));
                const max = @as(usize, @intCast(@max(rule.max, 0)));
                if (len < min or len > max) return false;
            },
            .required_present => {
                if (!fieldExists(body, fh)) return false;
            },
            .email, .uuid, .ipv4, .url => {
                const val = extractStringField(body, fh) orelse return false;
                if (!validateFieldValue(val, rule)) return false;
            },
        }
    }
    return true;
}

// =============================================================================
// Config parsing (simple format: field:type:min:max,...)
// "email:email,uuid:uuid,name:str_len:1:100,age:int:0:150"
// =============================================================================

fn parseInt(buf: []const u8) i64 {
    return std.fmt.parseInt(i64, buf, 10) catch 0;
}

fn parseFieldType(t: []const u8) FieldType {
    if (std.mem.eql(u8, t, "email")) return .email;
    if (std.mem.eql(u8, t, "uuid")) return .uuid;
    if (std.mem.eql(u8, t, "ipv4")) return .ipv4;
    if (std.mem.eql(u8, t, "url")) return .url;
    if (std.mem.eql(u8, t, "str_len")) return .string_length;
    if (std.mem.eql(u8, t, "int")) return .int_range;
    return .required_present;
}

fn parseConfig(config_data: []const u8) FilterConfig {
    if (config_data.len == 0) return .{ .validators = &.{} };

    const max_rules: usize = 64;
    var rules_buf: [64]FieldRule = undefined;
    var count: usize = 0;

    var it = std.mem.splitScalar(u8, config_data, ',');
    while (it.next()) |segment| {
        if (segment.len == 0) continue;
        if (count >= max_rules) break;

        var parts = std.mem.splitScalar(u8, segment, ':');
        const field = parts.next() orelse continue;
        const ftype_s = parts.next() orelse continue;
        const min_s = parts.next();
        const max_s = parts.next();

        rules_buf[count] = .{
            .field_name = field,
            .field_type = parseFieldType(ftype_s),
            .min = if (min_s) |ms| parseInt(ms) else 0,
            .max = if (max_s) |ms| parseInt(ms) else 0,
        };
        count += 1;
    }

    return .{ .validators = rules_buf[0..count] };
}

// =============================================================================
// Guest ABI: Exported functions called by Envoy
// =============================================================================

export fn proxy_abi_version_0_2_0() void {}

export fn proxy_on_vm_start(vm_config_size: u32, vm_config_ptr: ?[*]const u8) u32 {
    _ = vm_config_size;
    _ = vm_config_ptr;
    return ACTION_CONTINUE;
}

export fn proxy_on_configure(config_size: u32, config_ptr: ?[*]const u8) u32 {
    const cfg_data = if (config_size > 0)
        if (config_ptr) |ptr| ptr[0..config_size] else ""
    else
        "";

    config = parseConfig(cfg_data);
    log(LOG_INFO, "dhi envoy filter configured");
    return ACTION_CONTINUE;
}

export fn proxy_on_request_headers(num_headers: u32, end_of_stream: u32) u32 {
    _ = num_headers;
    // Check content-type
    const ct_key = "content-type";
    var ct_value: [64]u8 = undefined;
    const ct_len = proxy_get_header_map_value(
        MAP_REQUEST_HEADERS,
        ct_key.ptr,
        ct_key.len,
        &ct_value,
        ct_value.len,
    );

    if (ct_len > 0) {
        const ct = ct_value[0..@min(ct_len, ct_value.len)];
        if (std.mem.eql(u8, ct, CONTENT_TYPE_JSON) and end_of_stream != 0 and config.validators.len > 0) {
            // If no body but we have validators, reject
            const resp_body = "{\"error\":\"request body required\",\"valid\":false}";
            const resp_hdrs = "content-type: application/json";
            proxy_send_local_response(
                HTTP_STATUS_BAD_REQUEST,
                resp_body.ptr,
                resp_body.len,
                resp_hdrs.ptr,
                resp_hdrs.len,
                0,
            );
            return ACTION_CONTINUE;
        }
    }

    return ACTION_CONTINUE;
}

export fn proxy_on_request_body(body_size: u32, body_ptr: ?[*]const u8, end_of_stream: u32) u32 {
    if (config.validators.len == 0) return ACTION_CONTINUE;

    if (end_of_stream == 0) {
        // Need more data
        return ACTION_PAUSE;
    }

    if (body_size == 0 or body_ptr == null) {
        const resp_body = "{\"error\":\"empty request body\",\"valid\":false}";
        const resp_hdrs = "content-type: application/json";
        proxy_send_local_response(
            HTTP_STATUS_BAD_REQUEST,
            resp_body.ptr,
            resp_body.len,
            resp_hdrs.ptr,
            resp_hdrs.len,
            0,
        );
        return ACTION_CONTINUE;
    }

    const body = body_ptr.?[0..body_size];

    if (validateBody(body, config)) {
        return ACTION_CONTINUE;
    }

    const resp_body = "{\"error\":\"validation failed\",\"valid\":false}";
    const resp_hdrs = "content-type: application/json";
    proxy_send_local_response(
        HTTP_STATUS_BAD_REQUEST,
        resp_body.ptr,
        resp_body.len,
        resp_hdrs.ptr,
        resp_hdrs.len,
        0,
    );
    return ACTION_CONTINUE;
}
