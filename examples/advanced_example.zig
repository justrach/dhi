const std = @import("std");
const validator = @import("validator");
const combinators = @import("combinators");
const json_validator = @import("json_validator");

// Advanced example: E-commerce order system with complex validation

// Domain types with validation constraints
const Age = validator.BoundedInt(u8, 18, 120);
const Percentage = combinators.Range(f32, 0.0, 100.0);
const Price = combinators.Range(f32, 0.01, 999999.99);

// User with multiple validation rules
const User = struct {
    id: u32,
    username: []const u8, // Will validate non-empty via custom logic
    email: []const u8, // Email validation
    age: u8, // Will validate with Age bounds
    premium: bool,
    
    pub fn validate(allocator: std.mem.Allocator, data: anytype) !User {
        var errors = validator.ValidationErrors.init(allocator);
        defer errors.deinit();

        // Validate username (non-empty, 3-20 chars)
        const Username = validator.BoundedString(3, 20);
        const username = Username.validate(data.username, &errors, "username") catch data.username;

        // Validate email
        const email = validator.Email.validate(data.email, &errors, "email") catch data.email;

        // Validate age
        const age = Age.validate(data.age, &errors, "age") catch data.age;

        if (errors.hasErrors()) {
            std.debug.print("User validation errors:\n{f}\n", .{errors});
            return error.ValidationFailed;
        }

        return User{
            .id = data.id,
            .username = username,
            .email = email,
            .age = age,
            .premium = data.premium,
        };
    }
};

// Product with price validation
const Product = struct {
    id: u32,
    name: []const u8,
    price: f32,
    discount_percentage: f32,
    in_stock: bool,

    pub fn validate(allocator: std.mem.Allocator, data: anytype) !Product {
        var errors = validator.ValidationErrors.init(allocator);
        defer errors.deinit();

        // Validate name
        const ProductName = validator.BoundedString(1, 100);
        const name = ProductName.validate(data.name, &errors, "name") catch data.name;

        // Validate price
        const price = Price.validate(data.price, &errors, "price") catch data.price;

        // Validate discount percentage
        const discount = Percentage.validate(data.discount_percentage, &errors, "discount_percentage") catch data.discount_percentage;

        if (errors.hasErrors()) {
            std.debug.print("Product validation errors:\n{f}\n", .{errors});
            return error.ValidationFailed;
        }

        return Product{
            .id = data.id,
            .name = name,
            .price = price,
            .discount_percentage = discount,
            .in_stock = data.in_stock,
        };
    }

    pub fn finalPrice(self: Product) f32 {
        return self.price * (1.0 - self.discount_percentage / 100.0);
    }
};

// Order item with quantity validation
const OrderItem = struct {
    product_id: u32,
    quantity: u32,
    
    const MinQuantity = 1;
    const MaxQuantity = 999;

    pub fn validate(allocator: std.mem.Allocator, data: anytype) !OrderItem {
        var errors = validator.ValidationErrors.init(allocator);
        defer errors.deinit();

        const Quantity = validator.BoundedInt(u32, MinQuantity, MaxQuantity);
        const quantity = Quantity.validate(data.quantity, &errors, "quantity") catch data.quantity;

        if (errors.hasErrors()) {
            std.debug.print("OrderItem validation errors:\n{f}\n", .{errors});
            return error.ValidationFailed;
        }

        return OrderItem{
            .product_id = data.product_id,
            .quantity = quantity,
        };
    }
};

// Order with complex nested validation
const Order = struct {
    id: u32,
    user_id: u32,
    items: []OrderItem,
    status: OrderStatus,
    total: f32,

    const OrderStatus = enum {
        pending,
        confirmed,
        shipped,
        delivered,
        cancelled,
    };

    pub fn validate(allocator: std.mem.Allocator, data: anytype) !Order {
        var errors = validator.ValidationErrors.init(allocator);
        defer errors.deinit();

        // Validate items array (1-50 items)
        if (data.items.len == 0) {
            try errors.add("items", "Order must have at least 1 item");
        }
        if (data.items.len > 50) {
            try errors.add("items", "Order cannot have more than 50 items");
        }

        // Validate total (must be positive)
        if (data.total <= 0.0) {
            try errors.add("total", "Order total must be positive");
        }

        if (errors.hasErrors()) {
            std.debug.print("Order validation errors:\n{f}\n", .{errors});
            return error.ValidationFailed;
        }

        return Order{
            .id = data.id,
            .user_id = data.user_id,
            .items = data.items,
            .status = data.status,
            .total = data.total,
        };
    }
};

pub fn main() !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    std.debug.print("=== Advanced Validation Examples ===\n\n", .{});

    // Example 1: Combinator patterns
    std.debug.print("Example 1: Combinator patterns (Optional, Default, Range)\n", .{});
    {
        // Optional age - can be null
        const MaybeAge = combinators.Optional(Age);
        const age1 = try MaybeAge.initSome(try Age.init(27));
        const age2 = MaybeAge.initNone();
        
        std.debug.print("  ✓ Optional age (some): {}\n", .{age1.isSome()});
        std.debug.print("  ✓ Optional age (none): {}\n", .{age2.isNone()});

        // Default value pattern
        const AgeWithDefault = combinators.Default(u8, 18);
        const default_age = AgeWithDefault.init(null);
        std.debug.print("  ✓ Default age: {d}\n", .{default_age.value});

        // Range validation
        const Score = combinators.Range(f32, 0.0, 100.0);
        const score = try Score.init(87.5);
        std.debug.print("  ✓ Score in range: {d:.1}\n\n", .{score.value});
    }

    // Example 2: OneOf constraint (enum-like validation)
    std.debug.print("Example 2: OneOf constraint (allowed values)\n", .{});
    {
        const Priority = combinators.OneOf([]const u8, &.{ "low", "medium", "high", "critical" });
        
        const valid = try Priority.init("high");
        std.debug.print("  ✓ Valid priority: {s}\n", .{valid.value});

        const invalid = Priority.init("invalid");
        if (invalid) |_| {
            std.debug.print("  Unexpected success\n", .{});
        } else |err| {
            std.debug.print("  ✓ Invalid priority rejected: {}\n\n", .{err});
        }
    }

    // Example 3: User validation with multiple constraints
    std.debug.print("Example 3: User validation (complex struct)\n", .{});
    {
        const valid_user_data = .{
            .id = 1,
            .username = "rachpradhan",
            .email = "rach@example.com",
            .age = 27,
            .premium = true,
        };

        const user = try User.validate(allocator, valid_user_data);
        std.debug.print("  ✓ Valid user: {s} ({s}), age {d}, premium: {}\n", .{
            user.username,
            user.email,
            user.age,
            user.premium,
        });

        // Invalid user (multiple errors)
        const invalid_user_data = .{
            .id = 2,
            .username = "ab", // Too short (< 3 chars)
            .email = "invalid-email", // Invalid format
            .age = 15, // Too young (< 18)
            .premium = false,
        };

        std.debug.print("\n  Testing invalid user (expect multiple errors):\n", .{});
        _ = User.validate(allocator, invalid_user_data) catch |err| {
            std.debug.print("  Expected error: {}\n\n", .{err});
        };
    }

    // Example 4: Product with price and discount validation
    std.debug.print("Example 4: Product with price and discount validation\n", .{});
    {
        const product_data = .{
            .id = 101,
            .name = "Premium Widget Pro",
            .price = 99.99,
            .discount_percentage = 15.0,
            .in_stock = true,
        };

        const product = try Product.validate(allocator, product_data);
        const final_price = product.finalPrice();
        
        std.debug.print("  ✓ Product: {s}\n", .{product.name});
        std.debug.print("    Original price: ${d:.2}\n", .{product.price});
        std.debug.print("    Discount: {d:.1}%\n", .{product.discount_percentage});
        std.debug.print("    Final price: ${d:.2}\n", .{final_price});

        // Invalid product (price out of range)
        const invalid_product_data = .{
            .id = 102,
            .name = "Expensive Item",
            .price = 0.0, // Too low
            .discount_percentage = 150.0, // > 100%
            .in_stock = true,
        };

        std.debug.print("\n  Testing invalid product (expect errors):\n", .{});
        _ = Product.validate(allocator, invalid_product_data) catch |err| {
            std.debug.print("  Expected error: {}\n\n", .{err});
        };
    }

    // Example 5: Order validation with nested items
    std.debug.print("Example 5: Order validation (nested structures)\n", .{});
    {
        const item1_data = .{ .product_id = 101, .quantity = 2 };
        const item2_data = .{ .product_id = 102, .quantity = 1 };

        const item1 = try OrderItem.validate(allocator, item1_data);
        const item2 = try OrderItem.validate(allocator, item2_data);

        var items = [_]OrderItem{ item1, item2 };

        const order_data = .{
            .id = 1001,
            .user_id = 1,
            .items = items[0..],
            .status = Order.OrderStatus.pending,
            .total = 249.97,
        };

        const order = try Order.validate(allocator, order_data);
        std.debug.print("  ✓ Order #{d} for user #{d}\n", .{ order.id, order.user_id });
        std.debug.print("    Items: {d}\n", .{order.items.len});
        std.debug.print("    Status: {s}\n", .{@tagName(order.status)});
        std.debug.print("    Total: ${d:.2}\n", .{order.total});

        // Invalid order (empty items)
        const invalid_order_data = .{
            .id = 1002,
            .user_id = 2,
            .items = &[_]OrderItem{},
            .status = Order.OrderStatus.pending,
            .total = 0.0,
        };

        std.debug.print("\n  Testing invalid order (expect errors):\n", .{});
        _ = Order.validate(allocator, invalid_order_data) catch |err| {
            std.debug.print("  Expected error: {}\n\n", .{err});
        };
    }

    // Example 6: JSON integration with complex types
    std.debug.print("Example 6: JSON integration (end-to-end)\n", .{});
    {
        const json = 
            \\{
            \\  "id": 1,
            \\  "username": "alice",
            \\  "email": "alice@example.com",
            \\  "age": 25,
            \\  "premium": true
            \\}
        ;

        const user = try json_validator.parseAndValidate(User, json, allocator);
        std.debug.print("  ✓ User from JSON: {s} ({s})\n", .{ user.username, user.email });
    }

    // Example 7: Batch processing with statistics
    std.debug.print("\nExample 7: Batch processing with validation statistics\n", .{});
    {
        const json = 
            \\[
            \\  {"id": 1, "name": "Widget", "price": 19.99, "discount_percentage": 10.0, "in_stock": true},
            \\  {"id": 2, "name": "", "price": 29.99, "discount_percentage": 0.0, "in_stock": false},
            \\  {"id": 3, "name": "Gadget", "price": 39.99, "discount_percentage": 20.0, "in_stock": true},
            \\  {"id": 4, "name": "Gizmo", "price": 0.0, "discount_percentage": 5.0, "in_stock": false}
            \\]
        ;

        const results = try json_validator.batchValidate(Product, json, allocator);
        defer allocator.free(results);

        var valid_count: usize = 0;
        var invalid_count: usize = 0;
        var total_value: f32 = 0.0;

        for (results) |result| {
            if (result.isValid()) {
                valid_count += 1;
                const product = result.value().?;
                total_value += product.finalPrice();
            } else {
                invalid_count += 1;
            }
        }

        std.debug.print("  Batch validation statistics:\n", .{});
        std.debug.print("    Total items: {d}\n", .{results.len});
        std.debug.print("    Valid: {d}\n", .{valid_count});
        std.debug.print("    Invalid: {d}\n", .{invalid_count});
        std.debug.print("    Success rate: {d:.1}%\n", .{@as(f32, @floatFromInt(valid_count)) / @as(f32, @floatFromInt(results.len)) * 100.0});
        std.debug.print("    Total value: ${d:.2}\n", .{total_value});
    }

    std.debug.print("\n=== Advanced examples completed ===\n", .{});
}
