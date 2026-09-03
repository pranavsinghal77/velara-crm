import { create } from 'zustand';
import type {
  AuthUser,
  Lead,
  Message,
  Notification,
  Reminder,
  User,
} from '../types/models';
import {
  ApiError,
  api,
  fetchAllPages,
  refreshSession,
  setAccessToken,
  setSessionLostHandler,
} from '../lib/api';
import { connectRealtime, disconnectRealtime } from '../lib/realtime';

/**
 * Server-backed store.
 *
 * Three things changed from the previous version, all of them load-bearing:
 *
 *  1. Nothing is persisted to localStorage. The old store persisted the whole
 *     dataset plus `currentUser.isLoggedIn`, which meant route protection was
 *     a boolean anyone could set by hand. Sessions are now restored from the
 *     httpOnly refresh cookie on boot.
 *  2. Writes are optimistic *with rollback*. The old actions fired
 *     `fetch(...).catch(console.error)` and left the UI showing data the
 *     server had rejected.
 *  3. There is no auto-seed. The old store called `GET /api/seed?force=true`
 *     whenever the lead list came back empty, which overwrote real records
 *     with demo rows.
 */

interface AuthState {
  currentUser: AuthUser | null;
  organization: { id: string; name: string; slug: string } | null;
}

interface CrmState extends AuthState {
  leads: Lead[];
  users: User[];
  messages: Message[];
  reminders: Reminder[];
  notifications: Notification[];

  /** True until the initial session check resolves; gates route rendering. */
  isBootstrapping: boolean;
  isLoading: boolean;
  /** Last write failure, for the UI to surface. Cleared by `dismissError`. */
  error: string | null;

  // Leads
  setLeads: (leads: Lead[]) => void;
  addLead: (lead: Omit<Lead, 'id'> & { id?: string }) => Promise<void>;
  updateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;

  // Users
  setUsers: (users: User[]) => void;
  addUser: (input: {
    name: string;
    email: string;
    password: string;
    role: User['role'];
    permissions?: string[];
  }) => Promise<void>;
  updateUser: (id: string, patch: Partial<User>) => Promise<void>;
  toggleUserActive: (id: string) => Promise<void>;

  // Messages
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Promise<void>;
  markMessageRead: (id: string) => Promise<void>;

  // Reminders
  setReminders: (reminders: Reminder[]) => void;
  addReminder: (reminder: Omit<Reminder, 'id' | 'isToday' | 'isTomorrow'>) => Promise<void>;
  updateReminder: (id: string, patch: Partial<Reminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  toggleReminderCompleted: (id: string) => Promise<void>;

  // Notifications
  setNotifications: (notifications: Notification[]) => void;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Auth & lifecycle
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  startRealtime: () => void;
  fetchInitialData: () => Promise<void>;
  dismissError: () => void;
}

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: AuthUser['role'];
    permissions: string[];
  };
}

const EMPTY_DATA = {
  leads: [] as Lead[],
  users: [] as User[],
  messages: [] as Message[],
  reminders: [] as Reminder[],
  notifications: [] as Notification[],
};

function describe(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.details?.length) {
      return `${err.message}: ${err.details.map((d) => d.message).join(', ')}`;
    }
    return err.message;
  }
  return fallback;
}

export const useCrmStore = create<CrmState>()((set, get) => {
  /**
   * Applies an optimistic change, runs the request, and undoes the change if
   * the request fails. The snapshot is taken from the state at call time so a
   * rollback cannot clobber an unrelated concurrent edit to a different slice.
   */
  async function optimistic<K extends keyof typeof EMPTY_DATA>(
    slice: K,
    apply: (current: CrmState[K]) => CrmState[K],
    send: () => Promise<void>,
    failureMessage: string
  ): Promise<void> {
    const snapshot = get()[slice];
    set({ [slice]: apply(snapshot), error: null } as unknown as Partial<CrmState>);

    try {
      await send();
    } catch (err) {
      set({
        [slice]: snapshot,
        error: describe(err, failureMessage),
      } as unknown as Partial<CrmState>);
    }
  }

  return {
    ...EMPTY_DATA,
    currentUser: null,
    organization: null,
    isBootstrapping: true,
    isLoading: false,
    error: null,

    dismissError: () => set({ error: null }),

    // --- Leads ---------------------------------------------------------------

    setLeads: (leads) => set({ leads }),

    addLead: async (lead) => {
      // A temporary id keeps React keys stable until the server responds.
      const tempId = `temp_${crypto.randomUUID()}`;
      const optimisticLead = { ...lead, id: tempId } as Lead;

      const snapshot = get().leads;
      set({ leads: [optimisticLead, ...snapshot], error: null });

      try {
        const created = await api.post<Lead>('/leads', {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          status: lead.status,
          aiScore: lead.aiScore,
          aiScoreBreakdown: lead.aiScoreBreakdown,
          isHot: lead.isHot,
          tags: lead.tags,
          notes: lead.notes,
          company: lead.company,
          designation: lead.designation,
          city: lead.city,
          budget: lead.budget,
        });
        // Swap the placeholder for the server record (which carries the real
        // id, derived score fields and timestamps).
        set((s) => ({ leads: s.leads.map((l) => (l.id === tempId ? created : l)) }));
      } catch (err) {
        set({ leads: snapshot, error: describe(err, 'Could not save the lead') });
      }
    },

    updateLead: (id, patch) =>
      optimistic(
        'leads',
        (leads) => leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        async () => {
          const updated = await api.put<Lead>(`/leads/${id}`, patch);
          set((s) => ({ leads: s.leads.map((l) => (l.id === id ? updated : l)) }));
        },
        'Could not update the lead'
      ),

    deleteLead: (id) =>
      optimistic(
        'leads',
        (leads) => leads.filter((l) => l.id !== id),
        () => api.delete(`/leads/${id}`),
        'Could not delete the lead'
      ),

    // --- Users ---------------------------------------------------------------

    setUsers: (users) => set({ users }),

    addUser: async (input) => {
      try {
        const created = await api.post<User>('/users', input);
        set((s) => ({ users: [...s.users, created], error: null }));
      } catch (err) {
        // No optimistic insert here: the server assigns the id and may reject
        // the email as a duplicate, so showing the row first would be a lie.
        set({ error: describe(err, 'Could not invite the member') });
        throw err;
      }
    },

    updateUser: (id, patch) =>
      optimistic(
        'users',
        (users) => users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        async () => {
          const updated = await api.put<User>(`/users/${id}`, patch);
          set((s) => ({ users: s.users.map((u) => (u.id === id ? updated : u)) }));
        },
        'Could not update the member'
      ),

    toggleUserActive: (id) =>
      optimistic(
        'users',
        (users) => users.map((u) => (u.id === id ? { ...u, isActive: !u.isActive } : u)),
        async () => {
          const updated = await api.put<User>(`/users/${id}/toggle-active`);
          set((s) => ({ users: s.users.map((u) => (u.id === id ? updated : u)) }));
        },
        'Could not change the member status'
      ),

    // --- Messages ------------------------------------------------------------

    setMessages: (messages) => set({ messages }),

    addMessage: async (message) => {
      const tempId = `temp_${crypto.randomUUID()}`;
      const snapshot = get().messages;

      set({
        messages: [
          ...snapshot,
          { ...message, id: tempId, timestamp: new Date().toISOString() } as Message,
        ],
        error: null,
      });

      try {
        const created = await api.post<Message>('/messages', {
          leadId: message.leadId || undefined,
          content: message.content,
          sender: message.sender,
          channel: message.channel,
          isAISuggested: message.isAISuggested,
        });
        set((s) => ({ messages: s.messages.map((m) => (m.id === tempId ? created : m)) }));
      } catch (err) {
        set({ messages: snapshot, error: describe(err, 'Could not send the message') });
      }
    },

    markMessageRead: (id) =>
      optimistic(
        'messages',
        (messages) => messages.map((m) => (m.id === id ? { ...m, isRead: true } : m)),
        () => api.put(`/messages/${id}/read`),
        'Could not mark the message as read'
      ),

    // --- Reminders -----------------------------------------------------------

    setReminders: (reminders) => set({ reminders }),

    addReminder: async (reminder) => {
      const tempId = `temp_${crypto.randomUUID()}`;
      const snapshot = get().reminders;

      set({
        reminders: [
          { ...reminder, id: tempId, isToday: false, isTomorrow: false } as Reminder,
          ...snapshot,
        ],
        error: null,
      });

      try {
        const created = await api.post<Reminder>('/reminders', {
          leadId: reminder.leadId || undefined,
          leadName: reminder.leadName,
          task: reminder.task,
          dueDate: reminder.dueDate,
          dueTime: reminder.dueTime,
          priority: reminder.priority,
          type: reminder.type,
        });
        set((s) => ({
          reminders: s.reminders.map((r) => (r.id === tempId ? created : r)),
        }));
      } catch (err) {
        set({ reminders: snapshot, error: describe(err, 'Could not save the reminder') });
      }
    },

    updateReminder: (id, patch) =>
      optimistic(
        'reminders',
        (reminders) => reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        async () => {
          const updated = await api.put<Reminder>(`/reminders/${id}`, patch);
          set((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? updated : r)) }));
        },
        'Could not update the reminder'
      ),

    deleteReminder: (id) =>
      optimistic(
        'reminders',
        (reminders) => reminders.filter((r) => r.id !== id),
        () => api.delete(`/reminders/${id}`),
        'Could not delete the reminder'
      ),

    toggleReminderCompleted: (id) =>
      optimistic(
        'reminders',
        (reminders) =>
          reminders.map((r) => (r.id === id ? { ...r, isCompleted: !r.isCompleted } : r)),
        async () => {
          const updated = await api.put<Reminder>(`/reminders/${id}/toggle`);
          set((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? updated : r)) }));
        },
        'Could not update the reminder'
      ),

    // --- Notifications -------------------------------------------------------

    setNotifications: (notifications) => set({ notifications }),

    markNotificationRead: (id) =>
      optimistic(
        'notifications',
        (notifications) => notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        () => api.put(`/notifications/${id}/read`),
        'Could not mark the notification as read'
      ),

    markAllNotificationsRead: () =>
      optimistic(
        'notifications',
        (notifications) => notifications.map((n) => ({ ...n, isRead: true })),
        () => api.put('/notifications/read-all'),
        'Could not mark notifications as read'
      ),

    // --- Auth ----------------------------------------------------------------

    login: async (email, password) => {
      set({ error: null });
      const res = await api.post<LoginResponse>('/auth/login', { email, password });

      setAccessToken(res.accessToken);
      set({
        currentUser: { ...res.user, isLoggedIn: true },
      });

      await get().fetchInitialData();
      get().startRealtime();
    },

    logout: async () => {
      try {
        await api.post('/auth/logout');
      } catch {
        // A failed logout call should still clear the client; the refresh
        // token expires on its own.
      }
      disconnectRealtime();
      setAccessToken(null);
      set({ ...EMPTY_DATA, currentUser: null, organization: null, error: null });
    },

    /**
     * Runs once on mount. Tries the refresh cookie; a live session is restored
     * silently, anything else lands on the login screen.
     */
    bootstrap: async () => {
      try {
        const restored = await refreshSession();
        if (!restored) {
          set({ isBootstrapping: false });
          return;
        }

        const me = await api.get<{
          user: LoginResponse['user'];
          organization: { id: string; name: string; slug: string };
        }>('/auth/me');

        set({
          currentUser: { ...me.user, isLoggedIn: true },
          organization: me.organization,
        });

        await get().fetchInitialData();
        get().startRealtime();
      } catch {
        setAccessToken(null);
        set({ currentUser: null, organization: null });
      } finally {
        set({ isBootstrapping: false });
      }
    },

    /** Live updates from other members of the organisation. */
    startRealtime: () => {
      connectRealtime({
        onMessage: (message) => {
          set((state) =>
            // Our own optimistic insert already added it.
            state.messages.some((m) => m.id === message.id)
              ? state
              : { messages: [...state.messages, message] }
          );
        },
        onNotification: (notification) => {
          set((state) =>
            state.notifications.some((n) => n.id === notification.id)
              ? state
              : { notifications: [notification, ...state.notifications] }
          );
        },
      });
    },

    fetchInitialData: async () => {
      if (!get().currentUser) return;

      set({ isLoading: true, error: null });
      try {
        const [leads, users, messages, reminders, notifications] = await Promise.all([
          fetchAllPages<Lead>('/leads'),
          api.get<{ data: User[] }>('/users').then((r) => r.data),
          fetchAllPages<Message>('/messages'),
          fetchAllPages<Reminder>('/reminders'),
          fetchAllPages<Notification>('/notifications', {}, 2),
        ]);

        set({ leads, users, messages, reminders, notifications });
      } catch (err) {
        // An empty result is a legitimate state for a new tenant, so this only
        // reports the failure - it never substitutes demo data.
        set({ error: describe(err, 'Could not load your workspace') });
      } finally {
        set({ isLoading: false });
      }
    },
  };
});

// A 401 that survives a refresh means the session is gone for good.
setSessionLostHandler(() => {
  disconnectRealtime();
  setAccessToken(null);
  useCrmStore.setState({
    ...EMPTY_DATA,
    currentUser: null,
    organization: null,
    error: 'Your session expired. Please sign in again.',
  });
});
