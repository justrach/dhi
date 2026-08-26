const std = @import("std");
const model = @import("model");
const validators = @import("validators_comprehensive");

test "model and comprehensive validators share one exported module" {
    const User = model.Model("User", .{
        .email = model.EmailStr,
    });

    const user = try User.parse(.{ .email = "ada@example.com" });
    try std.testing.expectEqualStrings("ada@example.com", user.email);
    try std.testing.expect(validators.validateBase64("SGVsbG8="));
}
