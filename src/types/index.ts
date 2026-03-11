// ─── Lead ────────────────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: 'JustDial' | 'IndiaMART' | 'Website' | 'WhatsApp' | 'Referral';
  status: 'New' | 'Contacted' | 'Qualified' | 'Negotiation' | 'Won' | 'Lost';
  aiScore: number;
  aiScoreBreakdown: {
    sourceQuality: number;
    recency: number;
    profileCompleteness: number;
  };
  lastContact: string;
  isHot: boolean;
  tags: string[];
  notes: string;
  assignedTo: string;
  createdAt: string;
  company?: string;
  designation?: string;
  city?: string;
  budget?: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'Admin' | 'Manager' | 'Sales' | 'Viewer';
  isActive: boolean;
  avatar?: string;
  permissions: string[];
}

// ─── Message ──────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  leadId: string;
  content: string;
  sender: 'sent' | 'received';
  timestamp: string;
  channel: 'WhatsApp' | 'Email' | 'SMS';
  isRead: boolean;
  isAISuggested: boolean;
}

// ─── Reminder ─────────────────────────────────────────────────────────────────

export interface Reminder {
  id: string;
  leadId: string;
  leadName: string;
  task: string;
  dueDate: string;
  dueTime: string;
  isToday: boolean;
  isTomorrow: boolean;
  isCompleted: boolean;
  priority: 'High' | 'Medium' | 'Low';
  type: 'Manual' | 'AI-Generated';
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'lead' | 'reminder' | 'ai' | 'system';
  isRead: boolean;
  timestamp: string;
}

// ─── AIInsight ────────────────────────────────────────────────────────────────

export interface AIInsight {
  id: string;
  leadId: string;
  insight: string;
  action: string;
  confidence: number;
  timestamp: string;
}

// ─── AuthUser ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Sales' | 'Viewer';
  isLoggedIn: boolean;
}

// ─── localStorage keys ────────────────────────────────────────────────────────

const KEYS = {
  LEADS: 'velara_leads',
  USERS: 'velara_users',
  MESSAGES: 'velara_messages',
  REMINDERS: 'velara_reminders',
  NOTIFICATIONS: 'velara_notifications',
  CURRENT_USER: 'velara_current_user',
} as const;

// ─── Leads ────────────────────────────────────────────────────────────────────

export function getLeads(): Lead[] {
  const raw = localStorage.getItem(KEYS.LEADS);
  return raw ? (JSON.parse(raw) as Lead[]) : [];
}

export function saveLeads(leads: Lead[]): void {
  localStorage.setItem(KEYS.LEADS, JSON.stringify(leads));
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function getUsers(): User[] {
  const raw = localStorage.getItem(KEYS.USERS);
  return raw ? (JSON.parse(raw) as User[]) : [];
}

export function saveUsers(users: User[]): void {
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function getMessages(): Message[] {
  const raw = localStorage.getItem(KEYS.MESSAGES);
  return raw ? (JSON.parse(raw) as Message[]) : [];
}

export function saveMessages(messages: Message[]): void {
  localStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export function getReminders(): Reminder[] {
  const raw = localStorage.getItem(KEYS.REMINDERS);
  return raw ? (JSON.parse(raw) as Reminder[]) : [];
}

export function saveReminders(reminders: Reminder[]): void {
  localStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function getNotifications(): Notification[] {
  const raw = localStorage.getItem(KEYS.NOTIFICATIONS);
  return raw ? (JSON.parse(raw) as Notification[]) : [];
}

export function saveNotifications(notifications: Notification[]): void {
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifications));
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function getCurrentUser(): AuthUser | null {
  const raw = localStorage.getItem(KEYS.CURRENT_USER);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function saveCurrentUser(user: AuthUser): void {
  localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(KEYS.CURRENT_USER);
}
