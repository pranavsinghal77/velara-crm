import type { Lead, User, Message, Reminder, Notification, AuthUser } from '../types/models';

// ─── localStorage keys ────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  LEADS: 'velara_leads',
  USERS: 'velara_users',
  MESSAGES: 'velara_messages',
  REMINDERS: 'velara_reminders',
  NOTIFICATIONS: 'velara_notifications',
  CURRENT_USER: 'velara_current_user',
} as const;

// ─── Leads ────────────────────────────────────────────────────────────────────

export function getLeads(): Lead[] {
  const raw = localStorage.getItem(STORAGE_KEYS.LEADS);
  return raw ? (JSON.parse(raw) as Lead[]) : [];
}

export function saveLeads(leads: Lead[]): void {
  localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function getUsers(): User[] {
  const raw = localStorage.getItem(STORAGE_KEYS.USERS);
  return raw ? (JSON.parse(raw) as User[]) : [];
}

export function saveUsers(users: User[]): void {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function getMessages(): Message[] {
  const raw = localStorage.getItem(STORAGE_KEYS.MESSAGES);
  return raw ? (JSON.parse(raw) as Message[]) : [];
}

export function saveMessages(messages: Message[]): void {
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export function getReminders(): Reminder[] {
  const raw = localStorage.getItem(STORAGE_KEYS.REMINDERS);
  return raw ? (JSON.parse(raw) as Reminder[]) : [];
}

export function saveReminders(reminders: Reminder[]): void {
  localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(reminders));
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function getNotifications(): Notification[] {
  const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
  return raw ? (JSON.parse(raw) as Notification[]) : [];
}

export function saveNotifications(notifications: Notification[]): void {
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function getCurrentUser(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function saveCurrentUser(user: AuthUser): void {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}
