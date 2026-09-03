import type {
  FieldCampaign,
  FieldTask,
  Lead,
  Message,
  Notification,
  Reminder,
  User,
} from '@prisma/client';
import { isToday, isTomorrow, toDateString, toTimeString } from './time';

/**
 * The database stores correct types; the API presents the shape the client
 * already understands. Keeping the translation in one place means the storage
 * layer can be fixed without a coordinated frontend rewrite.
 *
 * Every serialiser is also an allowlist: fields not named here (passwordHash,
 * orgId, internal bookkeeping) cannot leak into a response by accident.
 */

export function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    permissions: user.permissions,
    avatar: user.avatar ?? undefined,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

export function serializeLead(lead: Lead) {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    status: lead.status,
    aiScore: lead.aiScore,
    aiScoreBreakdown: lead.aiScoreBreakdown ?? {
      sourceQuality: 0,
      recency: 0,
      profileCompleteness: 0,
    },
    isHot: lead.isHot,
    tags: lead.tags,
    notes: lead.notes,
    company: lead.company ?? undefined,
    designation: lead.designation ?? undefined,
    city: lead.city ?? undefined,
    budget: lead.budget ?? undefined,
    budgetLakhs: lead.budgetLakhs,
    assignedTo: lead.ownerId ?? '',
    lastContact: lead.lastContactAt ? toDateString(lead.lastContactAt) : '',
    createdAt: toDateString(lead.createdAt),
  };
}

export function serializeMessage(message: Message) {
  return {
    id: message.id,
    leadId: message.leadId ?? '',
    content: message.content,
    sender: message.direction,
    timestamp: message.sentAt.toISOString(),
    channel: message.channel,
    isRead: message.isRead,
    isAISuggested: message.isAISuggested,
    isInternal: message.isInternal,
    intent: message.intent ?? undefined,
    urgency: message.urgency ?? undefined,
  };
}

export function serializeReminder(reminder: Reminder, now = new Date()) {
  return {
    id: reminder.id,
    leadId: reminder.leadId ?? '',
    leadName: reminder.leadName,
    task: reminder.task,
    dueDate: toDateString(reminder.dueAt),
    dueTime: toTimeString(reminder.dueAt),
    dueAt: reminder.dueAt.toISOString(),
    // Derived, never stored - so a reminder made yesterday stops claiming to
    // be due today the moment the clock rolls over.
    isToday: isToday(reminder.dueAt, now),
    isTomorrow: isTomorrow(reminder.dueAt, now),
    isOverdue: !reminder.isCompleted && reminder.dueAt.getTime() < now.getTime(),
    isCompleted: reminder.isCompleted,
    priority: reminder.priority,
    type: reminder.type,
    notes: reminder.notes,
  };
}

export function serializeNotification(notification: Notification) {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    isRead: notification.isRead,
    timestamp: notification.createdAt.toISOString(),
  };
}

export function serializeFieldTask(task: FieldTask) {
  return {
    id: task.id,
    campaignId: task.campaignId,
    title: task.title,
    location: task.location,
    status: task.status,
    uploadedImageUrl: task.uploadedImageUrl ?? undefined,
    aiComplianceScore: task.aiComplianceScore ?? undefined,
    aiFeedback: task.aiFeedback ?? undefined,
    aiVerified: task.aiVerified,
    assignedToId: task.assignedToId ?? undefined,
  };
}

export function serializeCampaign(campaign: FieldCampaign & { tasks?: FieldTask[] }) {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description ?? undefined,
    startDate: campaign.startDate.toISOString(),
    endDate: campaign.endDate.toISOString(),
    budget: campaign.budget,
    status: campaign.status,
    tasks: (campaign.tasks ?? []).map(serializeFieldTask),
  };
}

/**
 * Parse a free-text budget ("3.5L", "1.2 Cr", "45000") into INR lakhs so the
 * database can aggregate pipeline value in SQL. Returns 0 for anything
 * unparseable rather than NaN, which would poison every downstream sum.
 */
export function parseBudgetToLakhs(budget?: string | null): number {
  if (!budget) return 0;

  const numeric = Number.parseFloat(budget.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric) || numeric < 0) return 0;

  const lower = budget.toLowerCase();
  if (lower.includes('cr')) return numeric * 100;
  if (lower.includes('l')) return numeric;
  // A bare number is rupees; convert to lakhs.
  return numeric / 100_000;
}
