const std = @import("std");
const validator = @import("validator");
const combinators = @import("combinators");
const json_validator = @import("json_validator");

// Benchmark configuration
const ITERATIONS = 1_000_000;
const BATCH_SIZE = 1000;

// Simple monotonic-clock timer (std.time.Timer was removed in Zig 0.16.0).
const Timer = struct {
    start_ns: u64,
    fn nowNs() u64 {
        var ts: std.c.timespec = undefined;
        _ = std.c.clock_gettime(.MONOTONIC, &ts);
        return @as(u64, @intCast(ts.sec)) * std.time.ns_per_s + @as(u64, @intCast(ts.nsec));
    }

    pub fn start() !Timer {
        return .{ .start_ns = nowNs() };
    }

    pub fn read(self: *Timer) u64 {
        return nowNs() - self.start_ns;
    }
};

const User = struct {
    name: []const u8,
    email: []const u8,
    age: u8,
};

fn benchmarkSingleValidation(allocator: std.mem.Allocator) !void {
    const Age = validator.BoundedInt(u8, 18, 90);
    const Name = validator.BoundedString(1, 40);

    var timer = try Timer.start();
    const start = timer.read();

    var i: usize = 0;
    while (i < ITERATIONS) : (i += 1) {
        var errors = validator.ValidationErrors.init(allocator);
        defer errors.deinit();

        _ = Name.validate("Rach Pradhan", &errors, "name") catch {};
        _ = validator.Email.validate("rach@example.com", &errors, "email") catch {};
        _ = Age.validate(27, &errors, "age") catch {};
    }

    const end = timer.read();
    const elapsed_ns = end - start;
    const elapsed_ms = @as(f64, @floatFromInt(elapsed_ns)) / 1_000_000.0;
    const per_sec = @as(f64, @floatFromInt(ITERATIONS)) / (elapsed_ms / 1000.0);

    std.debug.print("Single validation:\n", .{});
    std.debug.print("  Iterations: {d}\n", .{ITERATIONS});
    std.debug.print("  Time: {d:.2}ms\n", .{elapsed_ms});
    std.debug.print("  Throughput: {d:.0} validations/sec\n", .{per_sec});
    std.debug.print("  Per validation: {d:.2}ns\n\n", .{@as(f64, @floatFromInt(elapsed_ns)) / @as(f64, @floatFromInt(ITERATIONS))});
}

fn benchmarkBatchValidation(allocator: std.mem.Allocator) !void {
    const json = 
        \\[
        \\  {"name": "Alice", "email": "alice@example.com", "age": 25},
        \\  {"name": "Bob", "email": "bob@example.com", "age": 30},
        \\  {"name": "Carol", "email": "carol@example.com", "age": 28}
        \\]
    ;

    var timer = try Timer.start();
    const start = timer.read();

    var i: usize = 0;
    while (i < ITERATIONS / 100) : (i += 1) {
        const results = try json_validator.batchValidate(User, json, allocator);
        allocator.free(results);
    }

    const end = timer.read();
    const elapsed_ns = end - start;
    const elapsed_ms = @as(f64, @floatFromInt(elapsed_ns)) / 1_000_000.0;
    const total_items = (ITERATIONS / 100) * 3; // 3 items per batch
    const per_sec = @as(f64, @floatFromInt(total_items)) / (elapsed_ms / 1000.0);

    std.debug.print("Batch validation (3 items):\n", .{});
    std.debug.print("  Batches: {d}\n", .{ITERATIONS / 100});
    std.debug.print("  Total items: {d}\n", .{total_items});
    std.debug.print("  Time: {d:.2}ms\n", .{elapsed_ms});
    std.debug.print("  Throughput: {d:.0} items/sec\n", .{per_sec});
    std.debug.print("  Per item: {d:.2}ns\n\n", .{@as(f64, @floatFromInt(elapsed_ns)) / @as(f64, @floatFromInt(total_items))});
}

fn benchmarkJSONParsing(allocator: std.mem.Allocator) !void {
    const json = 
        \\{"name": "Rach", "email": "rach@example.com", "age": 27}
    ;

    var timer = try Timer.start();
    const start = timer.read();

    var i: usize = 0;
    while (i < ITERATIONS / 10) : (i += 1) {
        _ = try json_validator.parseAndValidate(User, json, allocator);
    }

    const end = timer.read();
    const elapsed_ns = end - start;
    const elapsed_ms = @as(f64, @floatFromInt(elapsed_ns)) / 1_000_000.0;
    const per_sec = @as(f64, @floatFromInt(ITERATIONS / 10)) / (elapsed_ms / 1000.0);

    std.debug.print("JSON parse + validate:\n", .{});
    std.debug.print("  Iterations: {d}\n", .{ITERATIONS / 10});
    std.debug.print("  Time: {d:.2}ms\n", .{elapsed_ms});
    std.debug.print("  Throughput: {d:.0} parses/sec\n", .{per_sec});
    std.debug.print("  Per parse: {d:.2}ns\n\n", .{@as(f64, @floatFromInt(elapsed_ns)) / @as(f64, @floatFromInt(ITERATIONS / 10))});
}

pub fn main() !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    std.debug.print("=== dhi Performance Benchmarks ===\n\n", .{});

    try benchmarkSingleValidation(allocator);
    try benchmarkBatchValidation(allocator);
    try benchmarkJSONParsing(allocator);

    std.debug.print("=== Benchmarks complete ===\n", .{});
}
