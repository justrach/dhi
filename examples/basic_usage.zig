const std = @import("std");
const validator = @import("validator");

// Example 1: Using constrained types directly
const Age = validator.BoundedInt(u8, 18, 90);
const Name = validator.BoundedString(1, 40);

// Example 2: Struct with manual validation
const User = struct {
    name: []const u8,
    email: []const u8,
    age: u8,

    pub fn validate(allocator: std.mem.Allocator, data: anytype) !User {
        var errors = validator.ValidationErrors.init(allocator);
        defer errors.deinit();

        // Validate name
        _ = Name.validate(data.name, &errors, "name") catch {};

        // Validate email
        _ = validator.Email.validate(data.email, &errors, "email") catch {};

        // Validate age
        _ = Age.validate(data.age, &errors, "age") catch {};

        if (errors.hasErrors()) {
            std.debug.print("Validation errors:\n{f}\n", .{errors});
            return error.ValidationFailed;
        }

        return User{
            .name = data.name,
            .email = data.email,
            .age = data.age,
        };
    }
};

// Example 3: Struct with automatic validation using naming conventions
const UserAuto = struct {
    name_ne: []const u8, // Non-empty convention
    email: []const u8, // Email convention
    age: u8,
};

// Example 4: Product with regex pattern (placeholder for future regex support)
const ProductCode = validator.Pattern("^[A-Z]{3}-\\d{4}$");

const Product = struct {
    code: []const u8,
    name: []const u8,
    price: f32,

    const MIN_PRICE = 0.01;
    const MAX_PRICE = 999999.99;

    pub fn validate(allocator: std.mem.Allocator, data: anytype) !Product {
        var errors = validator.ValidationErrors.init(allocator);
        defer errors.deinit();

        // Validate code pattern
        _ = ProductCode.validate(data.code, &errors, "code") catch {};

        // Validate name
        if (data.name.len == 0) {
            try errors.add("name", "Product name cannot be empty");
        }

        // Validate price range
        if (data.price < MIN_PRICE or data.price > MAX_PRICE) {
            const msg = try std.fmt.allocPrint(
                allocator,
                "Price {d:.2} must be between {d:.2} and {d:.2}",
                .{ data.price, MIN_PRICE, MAX_PRICE },
            );
            defer allocator.free(msg);
            try errors.add("price", msg);
        }

        if (errors.hasErrors()) {
            std.debug.print("Product validation errors:\n{f}\n", .{errors});
            return error.ValidationFailed;
        }

        return Product{
            .code = data.code,
            .name = data.name,
            .price = data.price,
        };
    }
};

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    std.debug.print("=== Satya-Style Validation in Zig ===\n\n", .{});

    // Example 1: Direct constrained type usage
    std.debug.print("Example 1: Direct constrained types\n", .{});
    {
        const age = Age.init(27) catch |err| {
            std.debug.print("  Age validation failed: {}\n", .{err});
            return;
        };
        std.debug.print("  ✓ Valid age: {d}\n", .{age.value});

        const name = Name.init("Rach") catch |err| {
            std.debug.print("  Name validation failed: {}\n", .{err});
            return;
        };
        std.debug.print("  ✓ Valid name: {s}\n\n", .{name.slice});
    }

    // Example 2: Manual struct validation (collect all errors)
    std.debug.print("Example 2: Manual struct validation\n", .{});
    {
        // Valid user
        const valid_data = .{
            .name = "Rach Pradhan",
            .email = "rach@example.com",
            .age = 27,
        };
        const user = try User.validate(allocator, valid_data);
        std.debug.print("  ✓ Valid user: {s}, {s}, {d}\n", .{ user.name, user.email, user.age });

        // Invalid user (multiple errors)
        const invalid_data = .{
            .name = "", // Too short
            .email = "not-an-email", // Invalid format
            .age = 15, // Out of range
        };
        std.debug.print("\n  Testing invalid user (expect errors):\n", .{});
        _ = User.validate(allocator, invalid_data) catch |err| {
            std.debug.print("  Expected error: {}\n\n", .{err});
        };
    }

    // Example 3: Automatic validation using naming conventions
    std.debug.print("Example 3: Automatic validation (naming conventions)\n", .{});
    {
        var errors = validator.ValidationErrors.init(allocator);
        defer errors.deinit();

        const user_auto = UserAuto{
            .name_ne = "", // Violates non-empty convention
            .email = "invalid", // Violates email convention
            .age = 27,
        };

        try validator.validateStruct(UserAuto, user_auto, &errors);

        if (errors.hasErrors()) {
            std.debug.print("  Validation errors detected:\n  {f}\n\n", .{errors});
        }
    }

    // Example 4: Product validation with price range
    std.debug.print("Example 4: Product with price range validation\n", .{});
    {
        const valid_product = .{
            .code = "ABC-1234",
            .name = "Widget Pro",
            .price = 99.99,
        };
        const product = try Product.validate(allocator, valid_product);
        std.debug.print("  ✓ Valid product: {s}, {s}, ${d:.2}\n", .{ product.code, product.name, product.price });

        const invalid_product = .{
            .code = "XYZ-5678",
            .name = "",
            .price = 0.0, // Too low
        };
        std.debug.print("\n  Testing invalid product (expect errors):\n", .{});
        _ = Product.validate(allocator, invalid_product) catch |err| {
            std.debug.print("  Expected error: {}\n\n", .{err});
        };
    }

    // Example 5: ValidationResult pattern (dhi-style)
    std.debug.print("Example 5: ValidationResult pattern\n", .{});
    {
        // Create a result-style validator
        const user_data = User{
            .name = "Alice",
            .email = "alice@example.com",
            .age = 25,
        };

        const Validator = validator.deriveValidator(User);
        var result = try Validator.validate(user_data, allocator);
        defer result.deinit();

        if (result.isValid()) {
            const user = result.value().?;
            std.debug.print("  ✓ Validation succeeded: {s}\n", .{user.name});
        } else {
            const errs = result.errors().?;
            std.debug.print("  ✗ Validation failed:\n  {f}\n", .{errs});
        }
    }

    std.debug.print("\n=== All examples completed ===\n", .{});
}
