import { ValidationForm } from "./components/ValidationForm";
import { HeroSection } from "./components/HeroSection";

// Sample data and schemas as constants
const SAMPLE_SCHEMAS = {
  simple: {
    dhi: `const UserSchema = dhi.object({
  name: dhi.string(),
  age: dhi.number(),
  email: dhi.string(),
  isAdmin: dhi.boolean()
});`,
    zod: `const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string(),
  isAdmin: z.boolean()
});`
  },
  complex: {
    dhi: `const UserSchema = dhi.object({
  id: dhi.string().uuid(),
  profile: dhi.object({
    firstName: dhi.string().min(2),
    lastName: dhi.string().min(2),
    age: dhi.number().min(0).max(120),
    email: dhi.string().email(),
    settings: dhi.object({
      theme: dhi.enum(['light', 'dark']),
      notifications: dhi.boolean(),
      language: dhi.string().default('en')
    })
  }),
  roles: dhi.array(dhi.string()),
  metadata: dhi.record(dhi.string(), dhi.any())
});`,
    zod: `const UserSchema = z.object({
  id: z.string().uuid(),
  profile: z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    age: z.number().min(0).max(120),
    email: z.string().email(),
    settings: z.object({
      theme: z.enum(['light', 'dark']),
      notifications: z.boolean(),
      language: z.string().default('en')
    })
  }),
  roles: z.array(z.string()),
  metadata: z.record(z.string(), z.any())
});`
  }
};

const SAMPLE_DATA = {
  simple: `{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com",
  "isAdmin": true
}`,
  complex: `{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "age": 30,
    "email": "john@example.com",
    "settings": {
      "theme": "dark",
      "notifications": true,
      "language": "en"
    }
  },
  "roles": ["user", "admin"],
  "metadata": {
    "lastLogin": "2024-03-15",
    "loginCount": 42
  }
}`
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-8">Try It Yourself!</h2>
        <p className="text-center text-muted-foreground mb-8">
          Compare DHI and Zod performance in real-time with your own data
        </p>
        <ValidationForm 
          sampleSchemas={SAMPLE_SCHEMAS}
          sampleData={SAMPLE_DATA}
        />
      </div>
    </div>
  );
}
