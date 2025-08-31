// ✅ BEFORE: Original Zod code
import { z } from 'zod';

// Define the schema
const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
  active: z.boolean()
});

// Type inference
type User = z.infer<typeof UserSchema>;

// Usage
const userData = {
  name: "John Doe",
  age: 30,
  email: "john@example.com",
  active: true
};

// Validation
try {
  const user = UserSchema.parse(userData);
  console.log('Valid user:', user);
} catch (error) {
  console.error('Validation failed:', error);
}

// Safe parsing
const result = UserSchema.safeParse(userData);
if (result.success) {
  console.log('User data is valid:', result.data);
} else {
  console.log('Validation errors:', result.error.issues);
}

// Batch validation (slow with Zod)
const users = Array.from({ length: 100000 }, (_, i) => ({
  name: `User${i}`,
  age: 20 + (i % 50),
  email: `user${i}@example.com`,
  active: i % 2 === 0
}));

console.time('Zod batch validation');
const validUsers = users.filter(user => UserSchema.safeParse(user).success);
console.timeEnd('Zod batch validation');
console.log(`Valid users: ${validUsers.length}/${users.length}`);
