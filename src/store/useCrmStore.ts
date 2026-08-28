import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lead, User, Message, Reminder, Notification, AuthUser } from '../types/models';

const API_BASE = 'http://localhost:3001/api';

// ─── Store Shape ──────────────────────────────────────────────────────────────

interface CrmState {
  // Data
  leads: Lead[];
  users: User[];
  messages: Message[];
  reminders: Reminder[];
  notifications: Notification[];
  currentUser: AuthUser | null;
  isLoading: boolean;

  // ── Lead actions ────────────────────────────────────────────────────────────
  setLeads: (leads: Lead[]) => void;
  addLead: (lead: Lead) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  deleteLead: (id: string) => void;

  // ── User actions ────────────────────────────────────────────────────────────
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  toggleUserActive: (id: string) => void;

  // ── Message actions ─────────────────────────────────────────────────────────
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  markMessageRead: (id: string) => void;

  // ── Reminder actions ────────────────────────────────────────────────────────
  setReminders: (reminders: Reminder[]) => void;
  addReminder: (reminder: Reminder) => void;
  updateReminder: (id: string, patch: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  toggleReminderCompleted: (id: string) => void;

  // ── Notification actions ────────────────────────────────────────────────────
  setNotifications: (notifications: Notification[]) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // ── Auth actions ────────────────────────────────────────────────────────────
  login: (user: AuthUser) => void;
  logout: () => void;

  // ── API actions ─────────────────────────────────────────────────────────────
  fetchInitialData: () => Promise<void>;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useCrmStore = create<CrmState>()(
  persist(
    (set, get) => ({
      // ── Initial data ──────────────────────────────────────────────────────
      leads: [],
      users: [],
      messages: [],
      reminders: [],
      notifications: [],
      currentUser: null,
      isLoading: false,

      // ── Lead actions ──────────────────────────────────────────────────────
      setLeads: (leads) => set({ leads }),
      addLead: (lead) => {
        set((s) => ({ leads: [lead, ...s.leads] }));
        fetch(`${API_BASE}/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead),
        }).catch((err) => console.error('Failed to sync lead creation', err));
      },
      updateLead: (id, patch) => {
        set((s) => ({
          leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        }));
        fetch(`${API_BASE}/leads/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }).catch((err) => console.error('Failed to sync lead update', err));
      },
      deleteLead: (id) => {
        set((s) => ({ leads: s.leads.filter((l) => l.id !== id) }));
        fetch(`${API_BASE}/leads/${id}`, {
          method: 'DELETE',
        }).catch((err) => console.error('Failed to sync lead deletion', err));
      },

      // ── User actions ──────────────────────────────────────────────────────
      setUsers: (users) => set({ users }),
      addUser: (user) => {
        set((s) => ({ users: [...s.users, user] }));
        fetch(`${API_BASE}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
        }).catch((err) => console.error('Failed to sync user creation', err));
      },
      updateUser: (id, patch) => {
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        }));
        fetch(`${API_BASE}/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }).catch((err) => console.error('Failed to sync user update', err));
      },
      toggleUserActive: (id) => {
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id ? { ...u, isActive: !u.isActive } : u
          ),
        }));
        fetch(`${API_BASE}/users/${id}/toggle-active`, {
          method: 'PUT',
        }).catch((err) => console.error('Failed to sync toggle active', err));
      },

      // ── Message actions ───────────────────────────────────────────────────
      setMessages: (messages) => set({ messages }),
      addMessage: (message) => {
        set((s) => ({ messages: [...s.messages, message] }));
        fetch(`${API_BASE}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        }).catch((err) => console.error('Failed to sync message creation', err));
      },
      markMessageRead: (id) => {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, isRead: true } : m
          ),
        }));
        fetch(`${API_BASE}/messages/${id}/read`, {
          method: 'PUT',
        }).catch((err) => console.error('Failed to sync message read status', err));
      },

      // ── Reminder actions ──────────────────────────────────────────────────
      setReminders: (reminders) => set({ reminders }),
      addReminder: (reminder) => {
        set((s) => ({ reminders: [reminder, ...s.reminders] }));
        fetch(`${API_BASE}/reminders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reminder),
        }).catch((err) => console.error('Failed to sync reminder creation', err));
      },
      updateReminder: (id, patch) => {
        set((s) => ({
          reminders: s.reminders.map((r) =>
            r.id === id ? { ...r, ...patch } : r
          ),
        }));
        fetch(`${API_BASE}/reminders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }).catch((err) => console.error('Failed to sync reminder update', err));
      },
      deleteReminder: (id) => {
        set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
        fetch(`${API_BASE}/reminders/${id}`, {
          method: 'DELETE',
        }).catch((err) => console.error('Failed to sync reminder deletion', err));
      },
      toggleReminderCompleted: (id) => {
        set((s) => ({
          reminders: s.reminders.map((r) =>
            r.id === id ? { ...r, isCompleted: !r.isCompleted } : r
          ),
        }));
        fetch(`${API_BASE}/reminders/${id}/toggle`, {
          method: 'PUT',
        }).catch((err) => console.error('Failed to sync reminder toggle', err));
      },

      // ── Notification actions ──────────────────────────────────────────────
      setNotifications: (notifications) => set({ notifications }),
      markNotificationRead: (id) => {
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        }));
        fetch(`${API_BASE}/notifications/${id}/read`, {
          method: 'PUT',
        }).catch((err) => console.error('Failed to sync notification read', err));
      },
      markAllNotificationsRead: () => {
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
        }));
        fetch(`${API_BASE}/notifications/read-all`, {
          method: 'PUT',
        }).catch((err) => console.error('Failed to sync all notifications read', err));
      },

      // ── Auth actions ──────────────────────────────────────────────────────
      login: (user) => set({ currentUser: user }),
      logout: () => set({ currentUser: null }),

      // ── API actions ───────────────────────────────────────────────────────
      fetchInitialData: async () => {
        set({ isLoading: true });
        try {
          const [leadsRes, messagesRes, usersRes, remindersRes, notifsRes] = await Promise.all([
            fetch(`${API_BASE}/leads`),
            fetch(`${API_BASE}/messages`),
            fetch(`${API_BASE}/users`),
            fetch(`${API_BASE}/reminders`),
            fetch(`${API_BASE}/notifications`),
          ]);

          let leads = leadsRes.ok ? await leadsRes.json() : [];
          let messages = messagesRes.ok ? await messagesRes.json() : [];
          let users = usersRes.ok ? await usersRes.json() : [];
          let reminders = remindersRes.ok ? await remindersRes.json() : [];
          let notifications = notifsRes.ok ? await notifsRes.json() : [];

          // If DB is completely empty, auto-seed
          if (Array.isArray(leads) && leads.length === 0) {
            const seedRes = await fetch(`${API_BASE}/seed?force=true`);
            if (seedRes.ok) {
              const [reLeads, reMsgs, reUsers, reRems, reNotifs] = await Promise.all([
                fetch(`${API_BASE}/leads`).then((r) => r.json()),
                fetch(`${API_BASE}/messages`).then((r) => r.json()),
                fetch(`${API_BASE}/users`).then((r) => r.json()),
                fetch(`${API_BASE}/reminders`).then((r) => r.json()),
                fetch(`${API_BASE}/notifications`).then((r) => r.json()),
              ]);
              leads = reLeads;
              messages = reMsgs;
              users = reUsers;
              reminders = reRems;
              notifications = reNotifs;
            }
          }

          if (Array.isArray(leads) && leads.length > 0) set({ leads });
          if (Array.isArray(messages) && messages.length > 0) set({ messages });
          if (Array.isArray(users) && users.length > 0) set({ users });
          if (Array.isArray(reminders) && reminders.length > 0) set({ reminders });
          if (Array.isArray(notifications) && notifications.length > 0) set({ notifications });
        } catch (error) {
          console.warn('API backend not reached, using local persisted store', error);
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'velara-crm-store',
      partialize: (state) => ({
        leads: state.leads,
        users: state.users,
        messages: state.messages,
        reminders: state.reminders,
        notifications: state.notifications,
        currentUser: state.currentUser,
      }),
    }
  )
);
