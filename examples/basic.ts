import { dhi } from '../src';

// Define a schema
const UserSchema = dhi.object({
  id: dhi.number(),
  name: dhi.string(),
  email: dhi.string(),
  isActive: dhi.boolean(),
  tags: dhi.array(dhi.string())
});

// Valid data
const validUser = {
  id: 1,
  name: "John Doe",
  email: "john@example.com",
  isActive: true,
  tags: ["user", "admin"]
};

// Invalid data
const invalidUser = {
  id: "not-a-number",
  name: 123,
  email: "invalid-email",
  isActive: "true",
  tags: "not-an-array"
};

console.log("Validating valid user:");
console.log(UserSchema.validate(validUser));

console.log("\nValidating invalid user:");
console.log(UserSchema.validate(invalidUser)); 