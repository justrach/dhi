// ✅ BEFORE: Complex nested schema with Zod
import { z } from 'zod';

const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
  zipCode: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number()
  })
});

const ContactSchema = z.object({
  email: z.string().email(),
  phone: z.string(),
  address: AddressSchema
});

const UserProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  contact: ContactSchema,
  preferences: z.object({
    theme: z.enum(['light', 'dark']),
    notifications: z.boolean(),
    language: z.string()
  }),
  tags: z.array(z.string()),
  metadata: z.record(z.string())
});

type UserProfile = z.infer<typeof UserProfileSchema>;

// Complex test data
const profileData = {
  id: "user123",
  name: "Jane Smith",
  age: 28,
  contact: {
    email: "jane@example.com",
    phone: "+1-555-0123",
    address: {
      street: "123 Main St",
      city: "San Francisco",
      country: "USA",
      zipCode: "94105",
      coordinates: { lat: 37.7749, lng: -122.4194 }
    }
  },
  preferences: {
    theme: "dark" as const,
    notifications: true,
    language: "en"
  },
  tags: ["developer", "typescript", "react"],
  metadata: {
    createdAt: "2023-01-01",
    lastLogin: "2023-12-01"
  }
};

// Validation
const result = UserProfileSchema.safeParse(profileData);
console.log('Validation result:', result.success);

// Batch validation of complex objects
const profiles = Array.from({ length: 10000 }, (_, i) => ({
  ...profileData,
  id: `user${i}`,
  name: `User ${i}`
}));

console.time('Zod complex validation');
const validProfiles = profiles.filter(p => UserProfileSchema.safeParse(p).success);
console.timeEnd('Zod complex validation');
console.log(`Valid profiles: ${validProfiles.length}`);
