// 🚀 AFTER: Same code with DHI - just changed the import!
import { z } from 'dhi';  // ← Only change: 'zod' → 'dhi'

// Define the schema (identical code)
const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
  active: z.boolean()
});

// Type inference (identical code)
type User = z.infer<typeof UserSchema>;

// Usage (identical code)
const userData = {
  name: "John Doe",
  age: 30,
  email: "john@example.com",
  active: true
};

// Validation (identical code)
try {
  const user = UserSchema.parse(userData);
  console.log('Valid user:', user);
} catch (error) {
  console.error('Validation failed:', error);
}

// Safe parsing (identical code)
const result = UserSchema.safeParse(userData);
if (result.success) {
  console.log('User data is valid:', result.data);
} else {
  console.log('Validation errors:', result.error.issues);
}

// Batch validation (now 1.43x faster with DHI!)
const users = Array.from({ length: 100000 }, (_, i) => ({
  name: `User${i}`,
  age: 20 + (i % 50),
  email: `user${i}@example.com`,
  active: i % 2 === 0
}));

console.time('DHI batch validation');
const validUsers = users.filter(user => UserSchema.safeParse(user).success);
console.timeEnd('DHI batch validation');
console.log(`Valid users: ${validUsers.length}/${users.length}`);

// 📊 Performance Improvement: 1.43x faster than Zod
// 🎯 Zero code changes required beyond import statement!
