const std = @import("std");
const json_batch = @import("json_batch_validator");

const ITERATIONS = 50_000;
const ITEMS_PER_BATCH = 16;

const Timer = struct {
    start_ns: u64,

    fn nowNs() u64 {
        var ts: std.c.timespec = undefined;
        _ = std.c.clock_gettime(.MONOTONIC, &ts);
        return @as(u64, @intCast(ts.sec)) * std.time.ns_per_s + @as(u64, @intCast(ts.nsec));
    }

    fn start() Timer {
        return .{ .start_ns = nowNs() };
    }

    fn read(self: Timer) u64 {
        return nowNs() - self.start_ns;
    }
};

pub fn main() !void {
    const allocator = std.heap.smp_allocator;

    const json =
        \\[
        \\  {"name": "Alice", "age": 25, "email": "alice@example.com"},
        \\  {"name": "Bob", "age": 30, "email": "bob@example.com"},
        \\  {"name": "Carol", "age": 28, "email": "carol@example.com"},
        \\  {"name": "Dave", "age": 31, "email": "dave@example.com"},
        \\  {"name": "Erin", "age": 26, "email": "erin@example.com"},
        \\  {"name": "Faye", "age": 29, "email": "faye@example.com"},
        \\  {"name": "Gus", "age": 41, "email": "gus@example.com"},
        \\  {"name": "Hana", "age": 33, "email": "hana@example.com"},
        \\  {"name": "Ira", "age": 22, "email": "ira@example.com"},
        \\  {"name": "Jules", "age": 36, "email": "jules@example.com"},
        \\  {"name": "Kai", "age": 27, "email": "kai@example.com"},
        \\  {"name": "Lena", "age": 24, "email": "lena@example.com"},
        \\  {"name": "Mika", "age": 39, "email": "mika@example.com"},
        \\  {"name": "Noor", "age": 35, "email": "noor@example.com"},
        \\  {"name": "Omar", "age": 32, "email": "omar@example.com"},
        \\  {"name": "Pia", "age": 23, "email": "pia@example.com"}
        \\]
    ;

    const specs = [_]json_batch.FieldSpec{
        .{ .name = "name", .validator_type = .String, .param1 = 2, .param2 = 100 },
        .{ .name = "age", .validator_type = .Int, .param1 = 18, .param2 = 120 },
        .{ .name = "email", .validator_type = .Email },
    };

    var valid_count: usize = 0;
    const timer = Timer.start();
    for (0..ITERATIONS) |_| {
        const results = try json_batch.validateJsonArray(json, &specs, allocator);
        for (results) |result| {
            valid_count +%= @intFromBool(result.is_valid);
        }
        allocator.free(results);
    }
    std.mem.doNotOptimizeAway(valid_count);

    const elapsed_ns = timer.read();
    const total_items = ITERATIONS * ITEMS_PER_BATCH;
    const ns_per_item = @as(f64, @floatFromInt(elapsed_ns)) / @as(f64, @floatFromInt(total_items));
    const items_per_sec = @as(f64, @floatFromInt(total_items)) / (@as(f64, @floatFromInt(elapsed_ns)) / std.time.ns_per_s);
    std.debug.print("json_batch_array: {d:.2} ns/item, {d:.0} items/sec, valid={d}\n", .{
        ns_per_item,
        items_per_sec,
        valid_count,
    });
}
