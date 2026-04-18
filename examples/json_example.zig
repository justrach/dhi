const std = @import("std");
const validator = @import("validator");
const json_validator = @import("json_validator");

// Define validated struct types
const User = struct {
    name_ne: []const u8, // Non-empty convention
    email: []const u8, // Email validation convention
    age: u8,
    bio: ?[]const u8, // Optional field
};

const Product = struct {
    id: u32,
    name: []const u8,
    price: f32,
    in_stock: bool,
};

pub fn main() !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    std.debug.print("=== JSON Validation Examples (Satya-style) ===\n\n", .{});

    // Example 1: Parse and validate single JSON object
    std.debug.print("Example 1: Parse and validate single JSON object\n", .{});
    {
        const json = 
            \\{
            \\  "name_ne": "Rach Pradhan",
            \\  "email": "rach@example.com",
            \\  "age": 27,
            \\  "bio": "Software Engineer"
            \\}
        ;

        const user = try json_validator.parseAndValidate(User, json, allocator);
        std.debug.print("  ✓ Valid user: {s}, {s}, age {d}\n", .{ user.name_ne, user.email, user.age });
        if (user.bio) |bio| {
            std.debug.print("    Bio: {s}\n", .{bio});
        }
    }

    // Example 2: Optional field handling
    std.debug.print("\nExample 2: Optional field (missing bio)\n", .{});
    {
        const json = 
            \\{
            \\  "name_ne": "Alice",
            \\  "email": "alice@example.com",
            \\  "age": 25
            \\}
        ;

        const user = try json_validator.parseAndValidate(User, json, allocator);
        std.debug.print("  ✓ Valid user: {s}, {s}, age {d}\n", .{ user.name_ne, user.email, user.age });
        std.debug.print("    Bio: (none)\n", .{});
    }

    // Example 3: Validation failure (empty name)
    std.debug.print("\nExample 3: Validation failure (name_ne convention)\n", .{});
    {
        const json = 
            \\{
            \\  "name_ne": "",
            \\  "email": "bob@example.com",
            \\  "age": 30
            \\}
        ;

        std.debug.print("  Testing invalid user (expect errors):\n", .{});
        _ = json_validator.parseAndValidate(User, json, allocator) catch |err| {
            std.debug.print("  Expected error: {}\n", .{err});
        };
    }

    // Example 4: Validation failure (invalid email)
    std.debug.print("\nExample 4: Validation failure (email convention)\n", .{});
    {
        const json = 
            \\{
            \\  "name_ne": "Carol",
            \\  "email": "not-an-email",
            \\  "age": 28
            \\}
        ;

        std.debug.print("  Testing invalid email (expect errors):\n", .{});
        _ = json_validator.parseAndValidate(User, json, allocator) catch |err| {
            std.debug.print("  Expected error: {}\n", .{err});
        };
    }

    // Example 5: Multiple validation errors at once
    std.debug.print("\nExample 5: Multiple validation errors\n", .{});
    {
        const json = 
            \\{
            \\  "name_ne": "",
            \\  "email": "invalid",
            \\  "age": 30
            \\}
        ;

        std.debug.print("  Testing multiple errors (expect both name_ne and email):\n", .{});
        _ = json_validator.parseAndValidate(User, json, allocator) catch |err| {
            std.debug.print("  Expected error: {}\n", .{err});
        };
    }

    // Example 6: Type mismatch
    std.debug.print("\nExample 6: Type mismatch (age as string)\n", .{});
    {
        const json = 
            \\{
            \\  "name_ne": "Dave",
            \\  "email": "dave@example.com",
            \\  "age": "twenty-seven"
            \\}
        ;

        std.debug.print("  Testing type mismatch (expect error):\n", .{});
        _ = json_validator.parseAndValidate(User, json, allocator) catch |err| {
            std.debug.print("  Expected error: {}\n", .{err});
        };
    }

    // Example 7: Batch validation (dhi's validate_batch pattern)
    std.debug.print("\nExample 7: Batch validation (multiple products)\n", .{});
    {
        const json = 
            \\[
            \\  {"id": 1, "name": "Widget", "price": 19.99, "in_stock": true},
            \\  {"id": 2, "name": "Gadget", "price": 29.99, "in_stock": false},
            \\  {"id": 3, "name": "Gizmo", "price": 39.99, "in_stock": true}
            \\]
        ;

        const results = try json_validator.batchValidate(Product, json, allocator);
        defer allocator.free(results);

        std.debug.print("  Validated {d} products:\n", .{results.len});
        for (results, 0..) |result, i| {
            if (result.isValid()) {
                const product = result.value().?;
                std.debug.print("    [{d}] ✓ {s}: ${d:.2} (in_stock: {})\n", .{
                    i,
                    product.name,
                    product.price,
                    product.in_stock,
                });
            } else {
                std.debug.print("    [{d}] ✗ Validation failed\n", .{i});
            }
        }
    }

    // Example 8: Mixed valid/invalid batch
    std.debug.print("\nExample 8: Batch with mixed valid/invalid items\n", .{});
    {
        const json = 
            \\[
            \\  {"id": 1, "name": "Valid Product", "price": 10.00, "in_stock": true},
            \\  {"id": 2, "name": "", "price": 20.00, "in_stock": false}
            \\]
        ;

        const results = try json_validator.batchValidate(Product, json, allocator);
        defer allocator.free(results);

        var valid_count: usize = 0;
        var invalid_count: usize = 0;

        for (results) |result| {
            if (result.isValid()) {
                valid_count += 1;
            } else {
                invalid_count += 1;
            }
        }

        std.debug.print("  Batch results: {d} valid, {d} invalid\n", .{ valid_count, invalid_count });
    }

    // Example 9: Streaming validation simulation (NDJSON)
    std.debug.print("\nExample 9: Streaming validation (NDJSON)\n", .{});
    {
        const ndjson = 
            \\{"id": 1, "name": "Item 1", "price": 10.00, "in_stock": true}
            \\{"id": 2, "name": "Item 2", "price": 20.00, "in_stock": false}
            \\{"id": 3, "name": "Item 3", "price": 30.00, "in_stock": true}
        ;

        var stream = std.Io.Reader.fixed(ndjson);

        const callback = struct {
            fn process(result: validator.ValidationResult(Product)) !void {
                if (result.isValid()) {
                    const product = result.value().?;
                    std.debug.print("    ✓ Streamed: {s} (${d:.2})\n", .{ product.name, product.price });
                } else {
                    std.debug.print("    ✗ Invalid item in stream\n", .{});
                }
            }
        }.process;

        try json_validator.streamValidate(Product, &stream, allocator, callback);

        std.debug.print("  Streaming complete\n", .{});
    }

    std.debug.print("\n=== All JSON examples completed ===\n", .{});
}
