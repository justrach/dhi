/**
 * Complex Backend API with dhi Validation
 *
 * This demonstrates advanced patterns:
 * - Authentication & RBAC
 * - Nested resources (users -> posts -> comments)
 * - Discriminated unions for actions/state machines
 * - Complex queries with pagination, filtering, sorting
 * - Webhooks with signature verification
 * - File operations
 * - Batch operations
 */

import { Hono } from 'hono';
import { z } from 'dhi';

// ============================================================
// SCHEMA DEFINITIONS
// ============================================================

// --- Authentication ---
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  mfaCode: z.string().length(6).optional(),
});

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100).regex(/[A-Z]/).regex(/[0-9]/),
  name: z.string().min(1).max(100),
  role: z.enum(['user', 'admin', 'moderator']).default('user'),
  profile: z.object({
    bio: z.string().max(500).optional(),
    avatar: z.string().url().optional(),
    social: z.object({
      twitter: z.string().optional(),
      github: z.string().optional(),
      linkedin: z.string().url().optional(),
    }).optional(),
  }).optional(),
});

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// --- Users ---
const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  profile: z.object({
    bio: z.string().max(500).optional(),
    avatar: z.string().url().optional(),
  }).optional(),
  settings: z.object({
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean(),
      sms: z.boolean(),
    }).optional(),
    privacy: z.object({
      profilePublic: z.boolean(),
      showEmail: z.boolean(),
    }).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  }).optional(),
});

// --- Posts (nested under users) ---
const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  excerpt: z.string().max(500).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
  metadata: z.object({
    seoTitle: z.string().max(60).optional(),
    seoDescription: z.string().max(160).optional(),
    canonicalUrl: z.string().url().optional(),
  }).optional(),
  scheduledAt: z.string().datetime().optional(),
});

const UpdatePostSchema = CreatePostSchema.partial();

// --- Comments (nested under posts) ---
const CreateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  parentId: z.string().uuid().optional(), // For nested comments
});

// --- Complex Queries ---
const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().max(200).optional(),
});

const PostQuerySchema = ListQuerySchema.extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  tags: z.string().optional(), // comma-separated
  authorId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// --- Actions (Discriminated Union - State Machine Pattern) ---
const PostActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('publish'),
    scheduledAt: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal('unpublish'),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('archive'),
    reason: z.string().max(500),
  }),
  z.object({
    action: z.literal('restore'),
  }),
  z.object({
    action: z.literal('feature'),
    position: z.number().int().positive().max(10),
    duration: z.number().int().positive().max(30), // days
  }),
  z.object({
    action: z.literal('transfer'),
    newOwnerId: z.string().uuid(),
    keepOriginalAuthor: z.boolean().default(true),
  }),
]);

// --- Moderation Actions ---
const ModerationActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('flag'),
    reason: z.enum(['spam', 'harassment', 'misinformation', 'other']),
    details: z.string().max(1000).optional(),
  }),
  z.object({
    action: z.literal('remove'),
    reason: z.string().min(1).max(1000),
    notifyUser: z.boolean().default(true),
  }),
  z.object({
    action: z.literal('warn'),
    message: z.string().min(1).max(1000),
    severity: z.enum(['low', 'medium', 'high']),
  }),
  z.object({
    action: z.literal('ban'),
    reason: z.string().min(1).max(1000),
    duration: z.number().int().positive().optional(), // null = permanent
    scope: z.enum(['post', 'comment', 'all']).default('all'),
  }),
  z.object({
    action: z.literal('approve'),
    notes: z.string().max(500).optional(),
  }),
]);

// --- Batch Operations ---
const BatchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  hardDelete: z.boolean().default(false),
});

const BatchUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  updates: UpdatePostSchema,
});

const BatchActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: PostActionSchema,
});

// --- Webhooks ---
const WebhookCreateSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum([
    'user.created',
    'user.updated',
    'user.deleted',
    'post.created',
    'post.published',
    'post.deleted',
    'comment.created',
    'comment.flagged',
  ])).min(1),
  secret: z.string().min(32).max(256).optional(),
  metadata: z.record(z.string()).optional(),
});

// --- File Upload ---
const FileUploadMetadataSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^[\w-]+\/[\w-]+$/),
  size: z.number().int().positive().max(50 * 1024 * 1024), // 50MB
  purpose: z.enum(['avatar', 'attachment', 'media', 'document']),
  metadata: z.record(z.string()).optional(),
});

// --- Analytics ---
const AnalyticsQuerySchema = z.object({
  metrics: z.array(z.enum(['views', 'likes', 'comments', 'shares', 'time_on_page'])).min(1),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  filters: z.object({
    postIds: z.array(z.string().uuid()).optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
  }).optional(),
});

// --- API Key Management ---
const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum([
    'read:users',
    'write:users',
    'read:posts',
    'write:posts',
    'read:comments',
    'write:comments',
    'admin',
  ])).min(1),
  expiresAt: z.string().datetime().optional(),
  rateLimit: z.object({
    requests: z.number().int().positive().max(10000),
    window: z.enum(['second', 'minute', 'hour', 'day']),
  }).optional(),
});

// ============================================================
// VALIDATION MIDDLEWARE
// ============================================================

function validateBody<T>(schema: z.ZodType<T>) {
  return async (c: any, next: () => Promise<void>) => {
    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);
      if (!result.success) {
        return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
      }
      c.set('body', result.data);
      await next();
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400);
    }
  };
}

function validateQuery<T>(schema: z.ZodType<T>) {
  return async (c: any, next: () => Promise<void>) => {
    const query = c.req.query();
    const result = schema.safeParse(query);
    if (!result.success) {
      return c.json({ error: 'Invalid query', issues: result.error.issues }, 400);
    }
    c.set('query', result.data);
    await next();
  };
}

// ============================================================
// HONO APP
// ============================================================

const app = new Hono();

// --- Health & Info ---
app.get('/', (c) => c.json({ status: 'ok', version: '2.0.0' }));
app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));

// --- Authentication ---
app.post('/auth/login', validateBody(LoginSchema), (c) => {
  const body = c.get('body');
  return c.json({ token: 'jwt-token', user: { email: body.email } });
});

app.post('/auth/register', validateBody(RegisterSchema), (c) => {
  const body = c.get('body');
  return c.json({ id: crypto.randomUUID(), ...body }, 201);
});

app.post('/auth/refresh', validateBody(RefreshTokenSchema), (c) => {
  return c.json({ token: 'new-jwt-token' });
});

app.post('/auth/logout', (c) => c.json({ success: true }));

// --- Users ---
app.get('/users', validateQuery(ListQuerySchema), (c) => {
  const query = c.get('query');
  return c.json({ data: [], pagination: { page: query.page, limit: query.limit, total: 0 } });
});

app.get('/users/:id', (c) => {
  return c.json({ id: c.req.param('id'), name: 'User' });
});

app.put('/users/:id', validateBody(UpdateUserSchema), (c) => {
  const body = c.get('body');
  return c.json({ id: c.req.param('id'), ...body });
});

app.delete('/users/:id', (c) => {
  return c.json({ deleted: true });
});

// --- User's Posts (Nested Resource) ---
app.get('/users/:userId/posts', validateQuery(PostQuerySchema), (c) => {
  const query = c.get('query');
  return c.json({ data: [], pagination: { page: query.page, limit: query.limit, total: 0 } });
});

app.post('/users/:userId/posts', validateBody(CreatePostSchema), (c) => {
  const body = c.get('body');
  return c.json({ id: crypto.randomUUID(), userId: c.req.param('userId'), ...body }, 201);
});

app.get('/users/:userId/posts/:postId', (c) => {
  return c.json({ id: c.req.param('postId'), userId: c.req.param('userId') });
});

app.put('/users/:userId/posts/:postId', validateBody(UpdatePostSchema), (c) => {
  const body = c.get('body');
  return c.json({ id: c.req.param('postId'), userId: c.req.param('userId'), ...body });
});

app.delete('/users/:userId/posts/:postId', (c) => {
  return c.json({ deleted: true });
});

// --- Post Actions (State Machine) ---
app.post('/users/:userId/posts/:postId/actions', validateBody(PostActionSchema), (c) => {
  const action = c.get('body');
  return c.json({ success: true, action: action.action, postId: c.req.param('postId') });
});

// --- Comments (Nested under Posts) ---
app.get('/users/:userId/posts/:postId/comments', validateQuery(ListQuerySchema), (c) => {
  const query = c.get('query');
  return c.json({ data: [], pagination: { page: query.page, limit: query.limit, total: 0 } });
});

app.post('/users/:userId/posts/:postId/comments', validateBody(CreateCommentSchema), (c) => {
  const body = c.get('body');
  return c.json({
    id: crypto.randomUUID(),
    postId: c.req.param('postId'),
    userId: c.req.param('userId'),
    ...body,
  }, 201);
});

app.delete('/users/:userId/posts/:postId/comments/:commentId', (c) => {
  return c.json({ deleted: true });
});

// --- Moderation ---
app.post('/moderation/posts/:postId', validateBody(ModerationActionSchema), (c) => {
  const action = c.get('body');
  return c.json({ success: true, action: action.action, postId: c.req.param('postId') });
});

app.post('/moderation/comments/:commentId', validateBody(ModerationActionSchema), (c) => {
  const action = c.get('body');
  return c.json({ success: true, action: action.action, commentId: c.req.param('commentId') });
});

app.post('/moderation/users/:userId', validateBody(ModerationActionSchema), (c) => {
  const action = c.get('body');
  return c.json({ success: true, action: action.action, userId: c.req.param('userId') });
});

// --- Batch Operations ---
app.post('/batch/posts/delete', validateBody(BatchDeleteSchema), (c) => {
  const body = c.get('body');
  return c.json({ deleted: body.ids.length, ids: body.ids });
});

app.post('/batch/posts/update', validateBody(BatchUpdateSchema), (c) => {
  const body = c.get('body');
  return c.json({ updated: body.ids.length, ids: body.ids });
});

app.post('/batch/posts/action', validateBody(BatchActionSchema), (c) => {
  const body = c.get('body');
  return c.json({ processed: body.ids.length, action: body.action.action });
});

// --- Webhooks ---
app.get('/webhooks', (c) => {
  return c.json({ data: [] });
});

app.post('/webhooks', validateBody(WebhookCreateSchema), (c) => {
  const body = c.get('body');
  return c.json({ id: crypto.randomUUID(), ...body }, 201);
});

app.get('/webhooks/:id', (c) => {
  return c.json({ id: c.req.param('id'), url: 'https://example.com/webhook' });
});

app.delete('/webhooks/:id', (c) => {
  return c.json({ deleted: true });
});

app.post('/webhooks/:id/test', (c) => {
  return c.json({ success: true, deliveryId: crypto.randomUUID() });
});

// --- File Upload ---
app.post('/files/presigned-url', validateBody(FileUploadMetadataSchema), (c) => {
  const body = c.get('body');
  return c.json({
    uploadUrl: 'https://storage.example.com/upload',
    fileId: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    ...body,
  });
});

app.get('/files/:id', (c) => {
  return c.json({ id: c.req.param('id'), url: 'https://storage.example.com/file' });
});

app.delete('/files/:id', (c) => {
  return c.json({ deleted: true });
});

// --- Analytics ---
app.post('/analytics/query', validateBody(AnalyticsQuerySchema), (c) => {
  const body = c.get('body');
  return c.json({
    metrics: body.metrics,
    groupBy: body.groupBy,
    data: [],
  });
});

// --- API Keys ---
app.get('/api-keys', (c) => {
  return c.json({ data: [] });
});

app.post('/api-keys', validateBody(CreateApiKeySchema), (c) => {
  const body = c.get('body');
  return c.json({
    id: crypto.randomUUID(),
    key: 'sk_live_' + crypto.randomUUID().replace(/-/g, ''),
    ...body,
  }, 201);
});

app.delete('/api-keys/:id', (c) => {
  return c.json({ deleted: true });
});

app.post('/api-keys/:id/rotate', (c) => {
  return c.json({
    id: c.req.param('id'),
    key: 'sk_live_' + crypto.randomUUID().replace(/-/g, ''),
  });
});

// --- Schema Export (for documentation) ---
app.get('/schemas', (c) => {
  return c.json({
    login: LoginSchema.toJsonSchema(),
    register: RegisterSchema.toJsonSchema(),
    createPost: CreatePostSchema.toJsonSchema(),
    postAction: PostActionSchema.toJsonSchema(),
    moderationAction: ModerationActionSchema.toJsonSchema(),
    analyticsQuery: AnalyticsQuerySchema.toJsonSchema(),
  });
});

// ============================================================
// EXPORT
// ============================================================

const port = 3001;
console.log(`Complex API running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
