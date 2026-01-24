/// Pydantic-style Model API example
///
/// Shows how dhi's Zig API mirrors Pydantic's declarative validation:
///
/// Python (Pydantic):              Zig (dhi):
///   class User(BaseModel):          const User = dhi.Model("User", .{
///       name: str = Field(...)          .name = dhi.Str(.{ .min_length = 1 }),
///       email: EmailStr                 .email = dhi.EmailStr,
///       age: int = Field(gt=0)          .age = dhi.Int(i32, .{ .gt = 0 }),
///                                   });
///
const std = @import("std");
const dhi = @import("model");

// ============================================================================
// Define models (like Pydantic's BaseModel)
// ============================================================================

const User = dhi.Model("User", .{
    .name = dhi.Str(.{ .min_length = 1, .max_length = 100 }),
    .email = dhi.EmailStr,
    .age = dhi.Int(i32, .{ .gt = 0, .le = 150 }),
    .score = dhi.Float(f64, .{ .ge = 0, .le = 100 }),
});

const ServerConfig = dhi.Model("ServerConfig", .{
    .host = dhi.IPv4,
    .port = dhi.Int(u16, .{ .ge = 1, .le = 65535 }),
    .name = dhi.Str(.{ .min_length = 1, .max_length = 255 }),
    .url = dhi.HttpUrl,
});

const Measurement = dhi.Model("Measurement", .{
    .timestamp = dhi.IsoDatetime,
    .value = dhi.Float(f64, .{ .ge = -1000, .le = 1000 }),
    .sensor_id = dhi.Uuid,
});

// ============================================================================
// Usage
// ============================================================================

pub fn main() void {
    const print = std.debug.print;

    // Validate a user (like User.model_validate({...}))
    print("=== User Validation ===\n", .{});

    const user = User.parse(.{
        .name = "Alice Johnson",
        .email = "alice@example.com",
        .age = @as(i32, 28),
        .score = @as(f64, 95.5),
    }) catch |err| {
        print("Validation failed: {}\n", .{err});
        return;
    };

    print("Valid user: {s} ({s}), age {d}, score {d:.1}\n", .{
        user.name,
        user.email,
        user.age,
        user.score,
    });

    // Invalid user - fails fast with specific error
    print("\n=== Invalid User ===\n", .{});
    if (User.parse(.{
        .name = "", // Too short
        .email = "alice@example.com",
        .age = @as(i32, 28),
        .score = @as(f64, 50.0),
    })) |_| {
        print("Unexpectedly valid\n", .{});
    } else |err| {
        print("Correctly rejected: {} (empty name)\n", .{err});
    }

    // Server config validation
    print("\n=== Server Config ===\n", .{});
    const config = ServerConfig.parse(.{
        .host = "192.168.1.1",
        .port = @as(u16, 8080),
        .name = "production-api",
        .url = "https://api.example.com",
    }) catch |err| {
        print("Config invalid: {}\n", .{err});
        return;
    };

    print("Server: {s}:{d} ({s})\n", .{ config.host, config.port, config.name });

    // Measurement validation
    print("\n=== Measurement ===\n", .{});
    const measurement = Measurement.parse(.{
        .timestamp = "2024-01-15T10:30:00Z",
        .value = @as(f64, 23.5),
        .sensor_id = "550e8400-e29b-41d4-a716-446655440000",
    }) catch |err| {
        print("Measurement invalid: {}\n", .{err});
        return;
    };

    print("Reading: {d:.1} at {s}\n", .{ measurement.value, measurement.timestamp });

    // Show model metadata
    print("\n=== Model Info ===\n", .{});
    print("User model: {s} ({d} fields)\n", .{ User.Name, User.field_count });
    print("ServerConfig model: {s} ({d} fields)\n", .{ ServerConfig.Name, ServerConfig.field_count });
    print("Measurement model: {s} ({d} fields)\n", .{ Measurement.Name, Measurement.field_count });
}
