// 🚀 AFTER: Same Express API with DHI - just changed the import!
import express from 'express';
import { z } from 'dhi';  // ← Only change: 'zod' → 'dhi'

const app = express();
app.use(express.json());

// API schemas (identical code)
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(18).max(120),
  role: z.enum(['user', 'admin', 'moderator']),
  preferences: z.object({
    newsletter: z.boolean(),
    notifications: z.boolean()
  }).optional()
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  age: z.number().min(18).max(120).optional(),
  preferences: z.object({
    newsletter: z.boolean(),
    notifications: z.boolean()
  }).optional()
});

const QueryParamsSchema = z.object({
  page: z.string().transform(val => parseInt(val)).pipe(z.number().min(1)),
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(100)),
  search: z.string().optional(),
  role: z.enum(['user', 'admin', 'moderator']).optional()
});

// Middleware for validation (identical code)
const validateBody = (schema: z.ZodSchema) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues
      });
    }
    req.body = result.data;
    next();
  };
};

const validateQuery = (schema: z.ZodSchema) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: 'Query validation failed',
        details: result.error.issues
      });
    }
    req.query = result.data;
    next();
  };
};

// Routes (identical code)
app.post('/users', validateBody(CreateUserSchema), (req, res) => {
  console.log('Creating user:', req.body);
  res.json({ success: true, user: req.body });
});

app.put('/users/:id', validateBody(UpdateUserSchema), (req, res) => {
  console.log('Updating user:', req.params.id, req.body);
  res.json({ success: true, user: req.body });
});

app.get('/users', validateQuery(QueryParamsSchema), (req, res) => {
  console.log('Querying users:', req.query);
  res.json({ success: true, query: req.query });
});

// Bulk validation endpoint (now 3.14x faster with DHI!)
app.post('/users/bulk', (req, res) => {
  const users = req.body.users || [];
  
  console.time('DHI bulk validation');
  const validUsers = users.filter((user: any) => 
    CreateUserSchema.safeParse(user).success
  );
  console.timeEnd('DHI bulk validation');
  
  res.json({
    total: users.length,
    valid: validUsers.length,
    invalid: users.length - validUsers.length
  });
});

export default app;

// 📊 Performance Improvement: 3.14x faster for mixed valid/invalid data
// 🎯 Zero code changes required beyond import statement!
// 🚀 Your API now handles validation much faster with no breaking changes!
