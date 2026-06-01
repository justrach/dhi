const std = @import("std");
const validators = @import("validators_comprehensive.zig");

// =============================================================================
// Proxy-WASM ABI: Host imports (provided by Envoy)
// =============================================================================

extern fn proxy_log(level: u32, msg_ptr: [*]const u8, msg_size: usize) u32;
extern fn proxy_get_buffer_bytes(
    buffer_type: u32,
    start: usize,
    length: usize,
    return_value_ptr: *usize,
    return_value_size: *usize,
) u32;
extern fn proxy_get_header_map_value(
    map_type: u32,
    key_ptr: [*]const u8,
    key_size: usize,
    return_value_ptr: *usize,
    return_value_size: *usize,
) u32;
extern fn proxy_set_header_map_value(
    map_type: u32,
    key_ptr: [*]const u8,
    key_size: usize,
    value_ptr: [*]const u8,
    value_size: usize,
) u32;
extern fn proxy_send_local_response(
    status_code: u32,
    status_code_details_ptr: [*]const u8,
    status_code_details_size: usize,
    body_ptr: [*]const u8,
    body_size: usize,
    headers_ptr: [*]const u8,
    headers_size: usize,
    grpc_status: u32,
) u32;

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

const PROXY_RESULT_OK: u32 = 0;
const PROXY_BOOL_TRUE: u32 = 1;

const MAP_REQUEST_HEADERS: u32 = 0;

const BUFFER_REQUEST_BODY: u32 = 0;
const BUFFER_PLUGIN_CONFIGURATION: u32 = 7;

const HTTP_STATUS_OK: u32 = 200;
const HTTP_STATUS_BAD_REQUEST: u32 = 400;

const CONTENT_TYPE_JSON = "application/json";

const MAX_CONFIG_BYTES: usize = 16 * 1024;
const MAX_ROUTES: usize = 64;
const MAX_RULES: usize = 512;
const MAX_STREAMS: usize = 1024;
const MAX_HOST_ALLOC_BYTES: usize = 64 * 1024;

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
    field_hash: u64,
    field_type: FieldType,
    min: i64,
    max: i64,
    required: bool,
};

const RouteRule = struct {
    method: []const u8,
    path: []const u8,
    body_required: bool,
    rules_start: usize,
    rules_len: usize,
};

const RouteHeader = struct {
    method: []const u8,
    path: []const u8,
    body_required: bool,
};

const FilterConfig = struct {
    routes: []const RouteRule,
};

const RequestState = struct {
    active: bool = false,
    context_id: u32 = 0,
    has_route: bool = false,
    route_index: usize = 0,
    is_json: bool = false,
};

var config_storage: [MAX_CONFIG_BYTES]u8 = undefined;
var route_rules: [MAX_ROUTES]RouteRule = undefined;
var field_rules: [MAX_RULES]FieldRule = undefined;
var request_states: [MAX_STREAMS]RequestState = [_]RequestState{.{}} ** MAX_STREAMS;
var host_alloc_storage: [MAX_HOST_ALLOC_BYTES]u8 align(8) = undefined;
var host_alloc_offset: usize = 0;
var config: FilterConfig = .{ .routes = &.{} };

export fn proxy_on_memory_allocate(memory_size: usize) usize {
    const alignment: usize = 8;
    var start = (host_alloc_offset + alignment - 1) & ~(alignment - 1);

    if (start + memory_size > host_alloc_storage.len) {
        start = 0;
        if (memory_size > host_alloc_storage.len) return 0;
    }

    host_alloc_offset = start + memory_size;
    return @intFromPtr(&host_alloc_storage[start]);
}

export fn malloc(memory_size: usize) usize {
    return proxy_on_memory_allocate(memory_size);
}

fn log(level: u32, msg: []const u8) void {
    _ = proxy_log(level, msg.ptr, msg.len);
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

fn skipQuotedString(json: []const u8, start: usize) ?usize {
    var i = start + 1;
    while (i < json.len) : (i += 1) {
        if (json[i] == '\\') {
            i += 1;
            continue;
        }
        if (json[i] == '"') return i + 1;
    }
    return null;
}

fn findFieldValueStart(json: []const u8, field_hash: u64) ?usize {
    var i: usize = 0;
    var depth: usize = 0;

    while (i < json.len) {
        switch (json[i]) {
            '{', '[' => {
                depth += 1;
                i += 1;
            },
            '}', ']' => {
                if (depth > 0) depth -= 1;
                i += 1;
            },
            '"' => {
                const after_key = skipQuotedString(json, i) orelse return null;

                if (depth == 1) {
                    const key = json[i + 1 .. after_key - 1];
                    var value_start = after_key;
                    while (value_start < json.len and (json[value_start] == ' ' or json[value_start] == '\t' or json[value_start] == '\r' or json[value_start] == '\n')) value_start += 1;

                    if (value_start < json.len and json[value_start] == ':') {
                        value_start += 1;
                        while (value_start < json.len and (json[value_start] == ' ' or json[value_start] == '\t' or json[value_start] == '\r' or json[value_start] == '\n')) value_start += 1;
                        if (value_start < json.len and hashFieldName(key) == field_hash) return value_start;
                    }
                }

                i = after_key;
            },
            else => i += 1,
        }
    }

    return null;
}

fn extractStringField(json: []const u8, field_hash: u64) ?[]const u8 {
    var i = findFieldValueStart(json, field_hash) orelse return null;
    if (json[i] != '"') return null;

    const val_start = i + 1;
    i += 1;
    while (i < json.len and json[i] != '"') {
        if (json[i] == '\\') i += 1;
        i += 1;
    }
    if (i >= json.len) return null;
    return json[val_start..i];
}

fn extractIntField(json: []const u8, field_hash: u64) ?i64 {
    var i = findFieldValueStart(json, field_hash) orelse return null;
    if (!(json[i] == '-' or (json[i] >= '0' and json[i] <= '9'))) return null;

    const val_start = i;
    if (json[i] == '-') i += 1;
    while (i < json.len and json[i] >= '0' and json[i] <= '9') i += 1;
    return std.fmt.parseInt(i64, json[val_start..i], 10) catch null;
}

fn fieldExists(json: []const u8, field_hash: u64) bool {
    return findFieldValueStart(json, field_hash) != null;
}

// =============================================================================
// Route matching
// =============================================================================

fn getHostBuffer(buffer_type: u32, start: usize, length: usize) []const u8 {
    var value_ptr: usize = 0;
    var value_size: usize = 0;
    const result = proxy_get_buffer_bytes(buffer_type, start, length, &value_ptr, &value_size);
    if (result != PROXY_RESULT_OK or value_ptr == 0 or value_size == 0) return "";

    const value = @as([*]const u8, @ptrFromInt(value_ptr));
    return value[0..value_size];
}

fn getHeader(key: []const u8, out: []u8) []const u8 {
    _ = out;

    var value_ptr: usize = 0;
    var value_size: usize = 0;
    const result = proxy_get_header_map_value(
        MAP_REQUEST_HEADERS,
        key.ptr,
        key.len,
        &value_ptr,
        &value_size,
    );
    if (result != PROXY_RESULT_OK or value_ptr == 0 or value_size == 0) return "";

    const value = @as([*]const u8, @ptrFromInt(value_ptr));
    return value[0..value_size];
}

fn requestRouteIndexFromHeaders() ?usize {
    var method_buf: [16]u8 = undefined;
    var path_buf: [512]u8 = undefined;

    const method = getHeader(":method", &method_buf);
    const path = getHeader(":path", &path_buf);

    if (selectRouteIndex(method, path)) |route_index| return route_index;

    var msg_buf: [160]u8 = undefined;
    const msg = std.fmt.bufPrint(&msg_buf, "dhi envoy no matching route method={s} path={s}", .{ method, path }) catch "dhi envoy no matching route";
    log(LOG_WARN, msg);
    return null;
}

fn routeRules(route: RouteRule) []const FieldRule {
    return field_rules[route.rules_start .. route.rules_start + route.rules_len];
}

fn selectRouteIndex(method: []const u8, path: []const u8) ?usize {
    for (config.routes, 0..) |route, index| {
        if (routeMatches(route, method, path)) return index;
    }
    return null;
}

fn routeMatches(route: RouteRule, method: []const u8, path: []const u8) bool {
    const method_ok = route.method.len == 0 or std.ascii.eqlIgnoreCase(route.method, method);
    const path_ok = route.path.len == 0 or pathMatches(route.path, path);
    return method_ok and path_ok;
}

fn pathWithoutQuery(path: []const u8) []const u8 {
    if (std.mem.indexOfScalar(u8, path, '?')) |idx| return path[0..idx];
    return path;
}

fn nextSegment(path: []const u8, index: *usize) ?[]const u8 {
    while (index.* < path.len and path[index.*] == '/') index.* += 1;
    if (index.* >= path.len) return null;

    const start = index.*;
    while (index.* < path.len and path[index.*] != '/') index.* += 1;
    return path[start..index.*];
}

fn isPathParam(segment: []const u8) bool {
    return segment.len > 0 and (segment[0] == ':' or (segment[0] == '{' and segment[segment.len - 1] == '}'));
}

fn pathMatches(pattern: []const u8, actual_raw: []const u8) bool {
    const actual = pathWithoutQuery(actual_raw);
    if (std.mem.eql(u8, pattern, actual)) return true;

    var pattern_index: usize = 0;
    var actual_index: usize = 0;

    while (true) {
        const pattern_segment = nextSegment(pattern, &pattern_index);
        const actual_segment = nextSegment(actual, &actual_index);

        if (pattern_segment == null and actual_segment == null) return true;
        if (pattern_segment == null or actual_segment == null) return false;

        const p = pattern_segment.?;
        const a = actual_segment.?;
        if (!isPathParam(p) and !std.mem.eql(u8, p, a)) return false;
    }
}

fn isJsonContentType(content_type: []const u8) bool {
    return std.mem.indexOf(u8, content_type, CONTENT_TYPE_JSON) != null or
        std.mem.indexOf(u8, content_type, "+json") != null;
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

fn validateBodyWithRules(body: []const u8, rules: []const FieldRule) bool {
    for (rules) |rule| {
        switch (rule.field_type) {
            .int_range => {
                const val = extractIntField(body, rule.field_hash) orelse {
                    if (rule.required) return false;
                    continue;
                };
                if (val < rule.min or val > rule.max) return false;
            },
            .string_length => {
                const val = extractStringField(body, rule.field_hash) orelse {
                    if (rule.required) return false;
                    continue;
                };
                const min = @as(usize, @intCast(@max(rule.min, 0)));
                const max = @as(usize, @intCast(@max(rule.max, 0)));
                if (val.len < min or val.len > max) return false;
            },
            .required_present => {
                if (!fieldExists(body, rule.field_hash)) return false;
            },
            .email, .uuid, .ipv4, .url => {
                const val = extractStringField(body, rule.field_hash) orelse {
                    if (rule.required) return false;
                    continue;
                };
                if (!validateFieldValue(val, rule)) return false;
            },
        }
    }
    return true;
}

// =============================================================================
// Config parsing
//
// Backwards-compatible global format:
//   "email:email,uuid:uuid,name:str_len:1:100,age:int:0:150"
//
// Route-aware format generated from OpenAPI:
//   "POST /users=email:email,name:str_len:1:100;PUT /users/{id}=name:?str_len:1:100"
//
// Prefix a validator with '?' for optional fields. Missing optional fields pass;
// present optional fields must still satisfy their validator.
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

fn trimSpaces(value: []const u8) []const u8 {
    return std.mem.trim(u8, value, " \t\r\n");
}

fn copyConfig(config_data: []const u8) []const u8 {
    const len = @min(config_data.len, config_storage.len);
    if (len > 0) @memcpy(config_storage[0..len], config_data[0..len]);
    if (config_data.len > config_storage.len) log(LOG_WARN, "dhi envoy config truncated");
    return config_storage[0..len];
}

fn parseRuleList(rules_text: []const u8, start_count: usize) usize {
    var count = start_count;
    var it = std.mem.splitScalar(u8, rules_text, ',');

    while (it.next()) |segment_raw| {
        const segment = trimSpaces(segment_raw);
        if (segment.len == 0) continue;
        if (count >= MAX_RULES) {
            log(LOG_WARN, "dhi envoy max validation rules reached");
            break;
        }

        var parts = std.mem.splitScalar(u8, segment, ':');
        const field = trimSpaces(parts.next() orelse continue);
        var ftype_s = trimSpaces(parts.next() orelse continue);
        const min_s = parts.next();
        const max_s = parts.next();

        var required = true;
        if (ftype_s.len > 0 and ftype_s[0] == '?') {
            required = false;
            ftype_s = ftype_s[1..];
        }

        field_rules[count] = .{
            .field_hash = hashFieldName(field),
            .field_type = parseFieldType(ftype_s),
            .min = if (min_s) |ms| parseInt(trimSpaces(ms)) else 0,
            .max = if (max_s) |ms| parseInt(trimSpaces(ms)) else 0,
            .required = required,
        };
        count += 1;
    }

    return count;
}

fn parseRouteHeader(header: []const u8) RouteHeader {
    const trimmed = trimSpaces(header);
    if (std.mem.indexOfScalar(u8, trimmed, ' ')) |space| {
        var method = trimSpaces(trimmed[0..space]);
        var body_required = true;

        if (method.len > 0 and method[method.len - 1] == '?') {
            body_required = false;
            method = method[0 .. method.len - 1];
        }

        return .{
            .method = method,
            .path = trimSpaces(trimmed[space + 1 ..]),
            .body_required = body_required,
        };
    }

    return .{ .method = "", .path = trimmed, .body_required = true };
}

fn parseConfig(config_data: []const u8) FilterConfig {
    const stored = copyConfig(config_data);
    var route_count: usize = 0;
    var rule_count: usize = 0;

    if (stored.len == 0) return .{ .routes = route_rules[0..0] };

    // Existing global format has no '=' route separator.
    if (std.mem.indexOfScalar(u8, stored, '=') == null) {
        const rules_start = rule_count;
        rule_count = parseRuleList(stored, rule_count);
        route_rules[0] = .{
            .method = "",
            .path = "",
            .body_required = true,
            .rules_start = rules_start,
            .rules_len = rule_count - rules_start,
        };
        return .{ .routes = route_rules[0..1] };
    }

    var route_it = std.mem.splitScalar(u8, stored, ';');
    while (route_it.next()) |entry_raw| {
        const entry = trimSpaces(entry_raw);
        if (entry.len == 0) continue;
        if (route_count >= MAX_ROUTES) {
            log(LOG_WARN, "dhi envoy max routes reached");
            break;
        }

        const eq = std.mem.indexOfScalar(u8, entry, '=') orelse continue;
        const header = parseRouteHeader(entry[0..eq]);
        const rules_start = rule_count;
        rule_count = parseRuleList(entry[eq + 1 ..], rule_count);

        route_rules[route_count] = .{
            .method = header.method,
            .path = header.path,
            .body_required = header.body_required,
            .rules_start = rules_start,
            .rules_len = rule_count - rules_start,
        };
        route_count += 1;
    }

    return .{ .routes = route_rules[0..route_count] };
}

// =============================================================================
// Guest ABI: Exported functions called by Envoy
// =============================================================================

export fn proxy_abi_version_0_2_0() void {}

export fn proxy_on_vm_start(context_id: u32, vm_config_size: u32) u32 {
    _ = context_id;
    _ = vm_config_size;
    return PROXY_BOOL_TRUE;
}

export fn proxy_on_configure(context_id: u32, config_size: u32) u32 {
    _ = context_id;

    const cfg_data = if (config_size > 0)
        getHostBuffer(BUFFER_PLUGIN_CONFIGURATION, 0, config_size)
    else
        "";

    config = parseConfig(cfg_data);

    var msg_buf: [96]u8 = undefined;
    const msg = std.fmt.bufPrint(&msg_buf, "dhi envoy filter configured routes={d}", .{config.routes.len}) catch "dhi envoy filter configured";
    log(LOG_INFO, msg);
    return PROXY_BOOL_TRUE;
}

fn requestState(context_id: u32) *RequestState {
    for (&request_states) |*state| {
        if (state.active and state.context_id == context_id) return state;
    }

    for (&request_states) |*state| {
        if (!state.active) {
            state.* = .{ .active = true, .context_id = context_id };
            return state;
        }
    }

    const index = @as(usize, @intCast(context_id)) % request_states.len;
    request_states[index] = .{ .active = true, .context_id = context_id };
    return &request_states[index];
}

fn clearRequestState(context_id: u32) void {
    for (&request_states) |*state| {
        if (state.active and state.context_id == context_id) {
            state.* = .{};
            return;
        }
    }
}

export fn proxy_on_request_headers(context_id: u32, num_headers: u32, end_of_stream: u32) u32 {
    _ = num_headers;

    const state = requestState(context_id);
    state.has_route = false;
    state.route_index = 0;
    state.is_json = false;

    var ct_value: [128]u8 = undefined;
    const ct = getHeader("content-type", &ct_value);
    state.is_json = isJsonContentType(ct);
    if (!state.is_json) return ACTION_CONTINUE;

    const route_index = requestRouteIndexFromHeaders() orelse return ACTION_CONTINUE;
    state.has_route = true;
    state.route_index = route_index;

    if (end_of_stream == 0) return ACTION_CONTINUE;

    const route = config.routes[route_index];
    const rules = routeRules(route);
    if (rules.len == 0 or !route.body_required) return ACTION_CONTINUE;

    const resp_body = "{\"error\":\"request body required\",\"valid\":false}";
    const resp_details = "dhi_validation";
    const resp_hdrs = "";
    _ = proxy_send_local_response(
        HTTP_STATUS_BAD_REQUEST,
        resp_details.ptr,
        resp_details.len,
        resp_body.ptr,
        resp_body.len,
        resp_hdrs.ptr,
        resp_hdrs.len,
        0,
    );
    return ACTION_PAUSE;
}

export fn proxy_on_request_body(context_id: u32, body_size: u32, end_of_stream: u32) u32 {
    const state = requestState(context_id);
    if (!state.is_json) return ACTION_CONTINUE;
    if (!state.has_route or state.route_index >= config.routes.len) {
        log(LOG_WARN, "dhi envoy no matching route");
        return ACTION_CONTINUE;
    }

    const route = config.routes[state.route_index];
    const rules = routeRules(route);
    if (rules.len == 0) {
        log(LOG_WARN, "dhi envoy route has no rules");
        return ACTION_CONTINUE;
    }

    if (end_of_stream == 0) {
        // Need more data
        return ACTION_PAUSE;
    }

    const body = if (body_size > 0)
        getHostBuffer(BUFFER_REQUEST_BODY, 0, body_size)
    else
        "";

    if (body.len == 0) {
        if (!route.body_required) return ACTION_CONTINUE;

        const resp_body = "{\"error\":\"empty request body\",\"valid\":false}";
        const resp_details = "dhi_validation";
        const resp_hdrs = "";
        _ = proxy_send_local_response(
            HTTP_STATUS_BAD_REQUEST,
            resp_details.ptr,
            resp_details.len,
            resp_body.ptr,
            resp_body.len,
            resp_hdrs.ptr,
            resp_hdrs.len,
            0,
        );
        return ACTION_PAUSE;
    }

    if (validateBodyWithRules(body, rules)) {
        return ACTION_CONTINUE;
    }

    const resp_body = "{\"error\":\"validation failed\",\"valid\":false}";
    const resp_details = "dhi_validation";
    const resp_hdrs = "";
    _ = proxy_send_local_response(
        HTTP_STATUS_BAD_REQUEST,
        resp_details.ptr,
        resp_details.len,
        resp_body.ptr,
        resp_body.len,
        resp_hdrs.ptr,
        resp_hdrs.len,
        0,
    );
    return ACTION_PAUSE;
}

export fn proxy_on_log(context_id: u32) void {
    clearRequestState(context_id);
}
