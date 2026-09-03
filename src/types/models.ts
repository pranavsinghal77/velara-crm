// Wire types, mirroring what the API serialisers emit.

export type Role = 'Admin' | 'Manager' | 'Sales' | 'Viewer';

// --- Lead --------------------------------------------------------------------

export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  /** Free-form so a tenant can add its own channels without a deploy. */
  source: string;
  status: LeadStatus;
  aiScore: number;
  aiScoreBreakdown: {
    sourceQuality: number;
    recency: number;
    profileCompleteness: number;
  };
  /** `YYYY-MM-DD`, empty string when never contacted. */
  lastContact: string;
  isHot: boolean;
  tags: string[];
  notes: string;
  /** Owner user id, empty string when unassigned. */
  assignedTo: string;
  /** `YYYY-MM-DD`. */
  createdAt: string;
  company?: string;
  designation?: string;
  city?: string;
  /** As entered, e.g. "3.5L". */
  budget?: string;
  /** Server-normalised value in INR lakhs; use this for arithmetic. */
  budgetLakhs?: number;
}

// --- User --------------------------------------------------------------------

/**
 * No `password` field. The client never receives or holds one - the previous
 * model carried it, which is why the login screen was comparing passwords in
 * the browser.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  avatar?: string;
  permissions: string[];
  lastLoginAt?: string | null;
}

// --- Message -----------------------------------------------------------------

export interface Message {
  id: string;
  leadId: string;
  content: string;
  sender: 'sent' | 'received';
  /** ISO 8601. */
  timestamp: string;
  channel: 'WhatsApp' | 'Email' | 'SMS' | 'Call';
  isRead: boolean;
  isAISuggested: boolean;
  isInternal?: boolean;
  intent?: string;
  urgency?: string;
}

// --- Reminder ----------------------------------------------------------------

export interface Reminder {
  id: string;
  leadId: string;
  leadName: string;
  task: string;
  /** `YYYY-MM-DD` in the organisation timezone. */
  dueDate: string;
  /** `HH:mm` in the organisation timezone. */
  dueTime: string;
  /** ISO 8601 instant, for sorting. */
  dueAt?: string;
  /** Derived server-side at read time, so these never go stale. */
  isToday: boolean;
  isTomorrow: boolean;
  isOverdue?: boolean;
  isCompleted: boolean;
  priority: 'High' | 'Medium' | 'Low';
  type: 'Manual' | 'AI-Generated';
  notes?: string;
}

// --- Notification ------------------------------------------------------------

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'lead' | 'reminder' | 'ai' | 'system';
  isRead: boolean;
  /** ISO 8601. */
  timestamp: string;
}

// --- AI ----------------------------------------------------------------------

export interface AIInsight {
  id: string;
  leadId: string;
  insight: string;
  action: string;
  confidence: number;
  timestamp: string;
}

// --- Auth --------------------------------------------------------------------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
  /**
   * Cross-tenant operator. Only decides whether the console link is offered —
   * every /api/platform request is authorised server-side against the database.
   */
  isPlatformAdmin?: boolean;
  /**
   * Kept for the existing call sites, but it is no longer what protects a
   * route: the guard requires a live server session, and this object is not
   * persisted anywhere the user can edit it.
   */
  isLoggedIn: boolean;
}
