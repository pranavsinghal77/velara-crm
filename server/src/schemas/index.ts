import { z } from 'zod';

/**
 * Every write endpoint validates against one of these. Because `validate()`
 * replaces `req.body` with the parse result, these schemas double as field
 * allowlists - the previous `data: req.body` straight into Prisma let anyone
 * set `role`, `permissions` or `orgId` on themselves.
 */

// --- Primitives -------------------------------------------------------------

export const idParam = z.object({ id: z.string().uuid('Expected a valid id') });
export type IdParam = z.infer<typeof idParam>;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const timeOnly = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');

const roleEnum = z.enum(['Admin', 'Manager', 'Sales', 'Viewer']);
const leadStatusEnum = z.enum([
  'New',
  'Contacted',
  'Qualified',
  'Negotiation',
  'Won',
  'Lost',
]);
const priorityEnum = z.enum(['High', 'Medium', 'Low']);
const channelEnum = z.enum(['WhatsApp', 'Email', 'SMS', 'Call']);
const directionEnum = z.enum(['sent', 'received']);

/**
 * Passwords: length is the property that actually matters, so require a real
 * minimum rather than a decorative "one symbol" rule, and cap it because
 * bcrypt silently truncates past 72 bytes.
 */
const password = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(72, 'Password must be at most 72 characters');

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().uuid().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

// --- Auth -------------------------------------------------------------------

export const loginSchema = z.object({
  // A missing or empty password is now a validation failure, not a bypass.
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(72),
  newPassword: password,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// --- Users ------------------------------------------------------------------

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password,
  role: roleEnum.default('Sales'),
  permissions: z.array(z.string().max(64)).max(32).default([]),
  avatar: z.string().url().max(2048).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    role: roleEnum.optional(),
    permissions: z.array(z.string().max(64)).max(32).optional(),
    avatar: z.string().url().max(2048).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No updatable fields provided' });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// --- Leads ------------------------------------------------------------------

const leadFields = {
  name: z.string().trim().min(1, 'Name is required').max(160),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .max(24)
    .regex(/^[0-9+\-()\s]*$/, 'Phone may only contain digits and + - ( )')
    .default(''),
  source: z.string().trim().min(1).max(48).default('Website'),
  status: leadStatusEnum.default('New'),
  aiScore: z.number().int().min(0).max(100).default(50),
  aiScoreBreakdown: z
    .object({
      sourceQuality: z.number().min(0).max(100),
      recency: z.number().min(0).max(100),
      profileCompleteness: z.number().min(0).max(100),
    })
    .optional(),
  isHot: z.boolean().default(false),
  tags: z.array(z.string().trim().max(32)).max(20).default([]),
  notes: z.string().max(5000).default(''),
  company: z.string().trim().max(160).optional(),
  designation: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  budget: z.string().trim().max(32).optional(),
  /// Owner is a user id within the caller's organisation; membership is
  /// verified in the controller, not trusted from here.
  assignedTo: z.string().uuid().nullable().optional(),
  lastContact: dateOnly.optional(),
};

export const createLeadSchema = z.object(leadFields);
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z
  .object({
    name: leadFields.name.optional(),
    email: leadFields.email.optional(),
    phone: z
      .string()
      .trim()
      .max(24)
      .regex(/^[0-9+\-()\s]*$/, 'Phone may only contain digits and + - ( )')
      .optional(),
    source: z.string().trim().min(1).max(48).optional(),
    status: leadStatusEnum.optional(),
    aiScore: z.number().int().min(0).max(100).optional(),
    aiScoreBreakdown: leadFields.aiScoreBreakdown,
    isHot: z.boolean().optional(),
    tags: z.array(z.string().trim().max(32)).max(20).optional(),
    notes: z.string().max(5000).optional(),
    company: z.string().trim().max(160).nullable().optional(),
    designation: z.string().trim().max(120).nullable().optional(),
    city: z.string().trim().max(80).nullable().optional(),
    budget: z.string().trim().max(32).nullable().optional(),
    assignedTo: z.string().uuid().nullable().optional(),
    lastContact: dateOnly.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No updatable fields provided' });
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const leadListQuery = paginationQuery.extend({
  status: leadStatusEnum.optional(),
  isHot: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().trim().max(120).optional(),
  ownerId: z.string().uuid().optional(),
});
export type LeadListQuery = z.infer<typeof leadListQuery>;

// --- Messages ---------------------------------------------------------------

export const createMessageSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  content: z.string().trim().min(1, 'Message cannot be empty').max(10_000),
  sender: directionEnum,
  channel: channelEnum.default('Email'),
  isAISuggested: z.boolean().default(false),
  isInternal: z.boolean().default(false),
  intent: z.string().trim().max(48).optional(),
  urgency: z.string().trim().max(48).optional(),
});
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const messageListQuery = paginationQuery.extend({
  leadId: z.string().uuid().optional(),
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type MessageListQuery = z.infer<typeof messageListQuery>;

// --- Reminders --------------------------------------------------------------

export const createReminderSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  leadName: z.string().trim().max(160).default(''),
  task: z.string().trim().min(1, 'Task is required').max(500),
  dueDate: dateOnly,
  dueTime: timeOnly.default('09:00'),
  priority: priorityEnum.default('Medium'),
  type: z.enum(['Manual', 'AI-Generated']).default('Manual'),
  notes: z.string().max(2000).default(''),
});
export type CreateReminderInput = z.infer<typeof createReminderSchema>;

export const updateReminderSchema = z
  .object({
    leadId: z.string().uuid().nullable().optional(),
    leadName: z.string().trim().max(160).optional(),
    task: z.string().trim().min(1).max(500).optional(),
    dueDate: dateOnly.optional(),
    dueTime: timeOnly.optional(),
    priority: priorityEnum.optional(),
    type: z.enum(['Manual', 'AI-Generated']).optional(),
    notes: z.string().max(2000).optional(),
    isCompleted: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No updatable fields provided' });
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;

export const reminderListQuery = paginationQuery.extend({
  completed: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});
export type ReminderListQuery = z.infer<typeof reminderListQuery>;

// --- Notifications ----------------------------------------------------------

export const createNotificationSchema = z.object({
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(1000),
  type: z.enum(['lead', 'reminder', 'ai', 'system']).default('system'),
  /// Omit to broadcast to the whole organisation.
  userId: z.string().uuid().nullable().optional(),
});
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

// --- Field operations -------------------------------------------------------

export const createCampaignSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    budget: z.coerce.number().min(0).max(1e12).default(0),
    status: z.enum(['Active', 'Paused', 'Completed']).default('Active'),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const createFieldTaskSchema = z.object({
  campaignId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(240),
  status: z.enum(['Pending', 'In Progress', 'Submitted', 'Approved', 'Rejected']).default(
    'Pending'
  ),
  assignedToId: z.string().uuid().nullable().optional(),
});
export type CreateFieldTaskInput = z.infer<typeof createFieldTaskSchema>;

export const updateFieldTaskSchema = z
  .object({
    status: z
      .enum(['Pending', 'In Progress', 'Submitted', 'Approved', 'Rejected'])
      .optional(),
    /// Data URLs are accepted for camera uploads; capped so a payload cannot
    /// be used to fill the database.
    uploadedImageUrl: z.string().max(3_000_000).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No updatable fields provided' });
export type UpdateFieldTaskInput = z.infer<typeof updateFieldTaskSchema>;

// --- AI ---------------------------------------------------------------------

const aiHistory = z
  .array(
    z.object({
      sender: z.string().max(32),
      content: z.string().max(4000),
    })
  )
  .max(20)
  .default([]);

export const smartReplySchema = z.object({
  message: z.string().trim().min(1, 'Message content is required').max(4000),
});

export const sentimentSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(4000),
  history: aiHistory,
});

export const escalateSchema = z.object({
  leadId: z.string().uuid().optional(),
  leadName: z.string().trim().min(1).max(160),
  company: z.string().trim().max(160).optional(),
  budget: z.string().trim().max(32).optional(),
  targetTier: z.coerce.number().int().min(1).max(8).default(3),
  messages: aiHistory,
});

export const knowledgeQuerySchema = z.object({
  query: z.string().trim().min(1, 'Query is required').max(1000),
});

export const visualComplianceSchema = z.object({
  taskId: z.string().uuid().optional(),
  /// Base64 data URL of the field photo. The image is actually sent to the
  /// vision model - the previous implementation validated it and threw it away.
  image: z
    .string()
    .regex(
      /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/,
      'Expected a base64 data URL for a PNG, JPEG or WebP image'
    )
    .max(8_000_000),
  campaignRules: z.string().trim().max(2000).optional(),
});

export const aiChatSchema = z.object({
  query: z.string().trim().min(1, 'Query is required').max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(4000),
      })
    )
    .max(20)
    .default([]),
});

// --- Platform console --------------------------------------------------------

const planTierEnum = z.enum(['Trial', 'Business', 'Enterprise']);
const subStatusEnum = z.enum(['Trialing', 'Active', 'PastDue', 'Canceled', 'Suspended']);

export const tenantListQuery = paginationQuery.extend({
  tier: planTierEnum.optional(),
  status: subStatusEnum.optional(),
  search: z.string().trim().max(120).optional(),
});
export type TenantListQuery = z.infer<typeof tenantListQuery>;

export const updateSubscriptionSchema = z
  .object({
    tier: planTierEnum.optional(),
    status: subStatusEnum.optional(),
    seats: z.number().int().min(1).max(100_000).optional(),
    allowOverage: z.boolean().optional(),
    /// Null lifts a cap entirely; a number sets it. Keys are validated against
    /// the known limit names in resolveLimits, so an unknown key is ignored
    /// rather than silently stored.
    limitOverrides: z
      .record(z.string().max(40), z.number().int().min(0).max(100_000_000).nullable())
      .nullable()
      .optional(),
    trialEndsAt: z.string().datetime().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No updatable fields provided' });
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export const closePeriodSchema = z.object({
  pushToStripe: z.boolean().default(false),
});

// --- Connectivity ------------------------------------------------------------

const API_SCOPE_VALUES = [
  'leads:read',
  'leads:write',
  'messages:read',
  'messages:write',
  'reminders:read',
  'reminders:write',
  'documents:read',
  'analytics:read',
  'ai:invoke',
  '*',
] as const;

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, 'Give the key a name').max(80),
  scopes: z
    .array(z.enum(API_SCOPE_VALUES))
    .min(1, 'Grant at least one scope')
    .max(API_SCOPE_VALUES.length),
  /// Null or omitted means the key does not expire.
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

/**
 * Outbound URLs are restricted to https and rejected for loopback and
 * link-local addresses. Without this, a tenant admin could point a connection
 * at the server's own metadata endpoint and use us as an SSRF proxy.
 */
const externalHttpsUrl = z
  .string()
  .trim()
  .url('Enter a valid URL')
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') return false;
      const host = url.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '::1' ||
        host.endsWith('.localhost') ||
        host.endsWith('.internal') ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, 'Must be an https URL on a public host');

const mcpTransportEnum = z.enum(['http', 'sse']);

export const createMcpSchema = z.object({
  name: z.string().trim().min(1).max(60),
  url: externalHttpsUrl,
  transport: mcpTransportEnum.default('http'),
  credential: z.string().min(1).max(4096).optional(),
  credentialHeader: z.string().trim().min(1).max(64).default('Authorization'),
});
export type CreateMcpInput = z.infer<typeof createMcpSchema>;

export const updateMcpSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    url: externalHttpsUrl.optional(),
    transport: mcpTransportEnum.optional(),
    credential: z.string().min(1).max(4096).nullable().optional(),
    credentialHeader: z.string().trim().min(1).max(64).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No updatable fields provided' });
export type UpdateMcpInput = z.infer<typeof updateMcpSchema>;

export const updateAiConfigSchema = z
  .object({
    apiKey: z.string().min(10).max(512).nullable().optional(),
    model: z.string().trim().min(1).max(80).optional(),
    visionModel: z.string().trim().min(1).max(80).optional(),
    enabled: z.boolean().optional(),
    monthlyBudgetPaise: z.number().int().min(0).max(1_000_000_00).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No updatable fields provided' });
export type UpdateAiConfigInput = z.infer<typeof updateAiConfigSchema>;

const webhookEventEnum = z.enum([
  'lead.created',
  'lead.status_changed',
  'message.received',
  'reminder.overdue',
]);

export const createWebhookSchema = z.object({
  url: externalHttpsUrl,
  events: z.array(webhookEventEnum).min(1, 'Subscribe to at least one event').max(20),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z
  .object({
    url: externalHttpsUrl.optional(),
    events: z.array(webhookEventEnum).min(1).max(20).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No updatable fields provided' });
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

// --- Attendance --------------------------------------------------------------

const attendanceModeEnum = z.enum(['Office', 'Remote', 'OnDuty', 'Leave']);

export const clockInSchema = z.object({
  mode: attendanceModeEnum.default('Office'),
  /// Optional geotag from the field agent's device.
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  note: z.string().trim().max(280).default(''),
});
export type ClockInInput = z.infer<typeof clockInSchema>;

export const setAttendanceModeSchema = z.object({
  mode: attendanceModeEnum,
  note: z.string().trim().max(280).optional(),
});

export const attendanceListQuery = z.object({
  /// Defaults to the current month when omitted.
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').optional(),
  userId: z.string().uuid().optional(),
});
export type AttendanceListQuery = z.infer<typeof attendanceListQuery>;

// --- Documents ---------------------------------------------------------------

export const createDocumentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z
    .enum(['Contracts', 'Proposals', 'Invoices', 'Compliance', 'Marketing', 'Other'])
    .default('Contracts'),
  mimeType: z.string().trim().min(1).max(120),
  /// Base64 data URL. Capped at roughly 8 MB of encoded payload; larger files
  /// belong in object storage, which is the documented next step.
  data: z
    .string()
    .regex(/^data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/, 'Expected a base64 data URL')
    .max(11_000_000),
  leadId: z.string().uuid().nullable().optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const documentListQuery = paginationQuery.extend({
  category: z.string().trim().max(40).optional(),
  leadId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
});
export type DocumentListQuery = z.infer<typeof documentListQuery>;

// --- Workflows ---------------------------------------------------------------

const workflowTriggerEnum = z.enum([
  'lead_created',
  'lead_status_changed',
  'message_received',
  'reminder_overdue',
  'schedule',
]);

/// Action shapes the executor in services/events.service.ts understands.
const workflowAction = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_reminder'),
    task: z.string().trim().max(200).optional(),
    offsetDays: z.number().int().min(0).max(365).default(1),
    dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('10:00'),
    priority: z.enum(['High', 'Medium', 'Low']).default('Medium'),
  }),
  z.object({
    type: z.literal('set_status'),
    status: z.enum(['New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost']),
  }),
  z.object({ type: z.literal('tag_lead'), tag: z.string().trim().min(1).max(32) }),
  z.object({
    type: z.literal('notify'),
    title: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(500),
  }),
  z.object({ type: z.literal('mark_hot') }),
]);

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(''),
  trigger: workflowTriggerEnum,
  conditions: z.record(z.string().max(40), z.unknown()).nullable().optional(),
  actions: z.array(workflowAction).min(1, 'Add at least one action').max(10),
  enabled: z.boolean().default(true),
});
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

export const updateWorkflowSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(500).optional(),
    trigger: workflowTriggerEnum.optional(),
    conditions: z.record(z.string().max(40), z.unknown()).nullable().optional(),
    actions: z.array(workflowAction).min(1).max(10).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No updatable fields provided' });
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;

// --- Social channels ---------------------------------------------------------

const socialPlatformEnum = z.enum(['instagram', 'facebook', 'linkedin', 'x', 'whatsapp']);

export const platformParam = z.object({ platform: socialPlatformEnum });
export type PlatformParam = z.infer<typeof platformParam>;

export const createSocialPostSchema = z
  .object({
    body: z.string().trim().max(63_206).default(''),
    /// Base64 data URL. Instagram requires media; the publisher rejects a
    /// text-only post for that platform before any provider call.
    mediaUrl: z
      .string()
      .regex(
        /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/,
        'Expected a base64 data URL for a PNG, JPEG or WebP image'
      )
      .max(8_000_000)
      .optional(),
    mediaMime: z.string().trim().max(64).optional(),
    connectionIds: z
      .array(z.string().uuid())
      .min(1, 'Choose at least one connected account')
      .max(20),
    /// Omit to publish now.
    scheduledAt: z.string().datetime().optional(),
  })
  .refine((v) => v.body.trim().length > 0 || Boolean(v.mediaUrl), {
    message: 'Add some text or an image',
    path: ['body'],
  });
export type CreateSocialPostInput = z.infer<typeof createSocialPostSchema>;

export const socialPostListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z
    .enum([
      'Draft',
      'Scheduled',
      'Publishing',
      'Published',
      'PartiallyPublished',
      'Failed',
      'Canceled',
    ])
    .optional(),
});
export type SocialPostListQuery = z.infer<typeof socialPostListQuery>;
