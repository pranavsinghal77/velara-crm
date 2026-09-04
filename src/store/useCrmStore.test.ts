import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCrmStore } from './useCrmStore';
import type { Lead, Reminder } from '../types/models';

vi.mock('../lib/realtime', () => ({
  connectRealtime: vi.fn(),
  disconnectRealtime: vi.fn(),
  isRealtimeConnected: () => false,
}));

const { api } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api,
    fetchAllPages: vi.fn(),
    refreshSession: vi.fn(),
    setAccessToken: vi.fn(),
    setSessionLostHandler: vi.fn(),
  };
});

const leadInput: Omit<Lead, 'id'> = {
  name: 'Test Lead',
  email: 'test@example.com',
  phone: '9876543210',
  source: 'Website',
  status: 'New',
  aiScore: 50,
  aiScoreBreakdown: { sourceQuality: 20, recency: 20, profileCompleteness: 10 },
  isHot: false,
  tags: [],
  notes: '',
  assignedTo: '',
  createdAt: '2026-01-01',
  lastContact: '2026-01-01',
};

function reset() {
  useCrmStore.setState({
    leads: [],
    users: [],
    messages: [],
    reminders: [],
    notifications: [],
    error: null,
  });
  vi.clearAllMocks();
}

describe('useCrmStore leads', () => {
  beforeEach(reset);

  it('shows the lead immediately and swaps in the server record', async () => {
    api.post.mockResolvedValue({ ...leadInput, id: 'server-id-1', aiScore: 73 });

    const promise = useCrmStore.getState().addLead(leadInput);

    // Optimistic row is visible before the request settles.
    expect(useCrmStore.getState().leads).toHaveLength(1);
    expect(useCrmStore.getState().leads[0]?.id).toMatch(/^temp_/);

    await promise;

    const [saved] = useCrmStore.getState().leads;
    expect(saved?.id).toBe('server-id-1');
    // Server-derived fields win over the optimistic guess.
    expect(saved?.aiScore).toBe(73);
    expect(useCrmStore.getState().error).toBeNull();
  });

  it('rolls the lead back and reports the error when the save fails', async () => {
    const { ApiError } = await import('../lib/api');
    api.post.mockRejectedValue(new ApiError(400, 'Validation failed', 'bad_request'));

    await useCrmStore.getState().addLead(leadInput);

    // This is the regression that mattered: the old store kept the row.
    expect(useCrmStore.getState().leads).toHaveLength(0);
    expect(useCrmStore.getState().error).toContain('Validation failed');
  });

  it('restores the previous value when an update fails', async () => {
    useCrmStore.setState({ leads: [{ ...leadInput, id: 'l1', status: 'New' }] });
    const { ApiError } = await import('../lib/api');
    api.put.mockRejectedValue(new ApiError(403, 'Requires Sales access', 'forbidden'));

    await useCrmStore.getState().updateLead('l1', { status: 'Won' });

    expect(useCrmStore.getState().leads[0]?.status).toBe('New');
    expect(useCrmStore.getState().error).toBe('Requires Sales access');
  });

  it('restores a deleted lead when the request fails', async () => {
    useCrmStore.setState({ leads: [{ ...leadInput, id: 'l1' }] });
    const { ApiError } = await import('../lib/api');
    api.delete.mockRejectedValue(new ApiError(500, 'Internal Server Error'));

    await useCrmStore.getState().deleteLead('l1');

    expect(useCrmStore.getState().leads).toHaveLength(1);
    expect(useCrmStore.getState().error).toBeTruthy();
  });

  it('removes the lead and keeps it removed on success', async () => {
    useCrmStore.setState({ leads: [{ ...leadInput, id: 'l1' }] });
    api.delete.mockResolvedValue(undefined);

    await useCrmStore.getState().deleteLead('l1');

    expect(useCrmStore.getState().leads).toHaveLength(0);
    expect(useCrmStore.getState().error).toBeNull();
  });
});

describe('useCrmStore reminders', () => {
  beforeEach(reset);

  const reminderInput: Omit<Reminder, 'id' | 'isToday' | 'isTomorrow'> = {
    leadId: '',
    leadName: 'Acme Ltd',
    task: 'Send the proposal',
    dueDate: '2026-03-10',
    dueTime: '10:00',
    isCompleted: false,
    priority: 'High',
    type: 'Manual',
  };

  it('trusts the server for the derived isToday/isTomorrow flags', async () => {
    api.post.mockResolvedValue({
      ...reminderInput,
      id: 'r1',
      isToday: true,
      isTomorrow: false,
    });

    await useCrmStore.getState().addReminder(reminderInput);

    expect(useCrmStore.getState().reminders[0]).toMatchObject({
      id: 'r1',
      isToday: true,
    });
  });

  it('reverts a failed completion toggle', async () => {
    useCrmStore.setState({
      reminders: [{ ...reminderInput, id: 'r1', isToday: false, isTomorrow: false }],
    });
    const { ApiError } = await import('../lib/api');
    api.put.mockRejectedValue(new ApiError(404, 'Reminder not found', 'not_found'));

    await useCrmStore.getState().toggleReminderCompleted('r1');

    expect(useCrmStore.getState().reminders[0]?.isCompleted).toBe(false);
    expect(useCrmStore.getState().error).toBe('Reminder not found');
  });
});

describe('useCrmStore auth', () => {
  beforeEach(reset);

  it('clears all workspace data on logout so nothing leaks to the next user', async () => {
    useCrmStore.setState({
      leads: [{ ...leadInput, id: 'l1' }],
      currentUser: {
        id: 'u1',
        name: 'A',
        email: 'a@b.com',
        role: 'Admin',
        permissions: [],
        isLoggedIn: true,
      },
    });
    api.post.mockResolvedValue(undefined);

    await useCrmStore.getState().logout();

    const state = useCrmStore.getState();
    expect(state.currentUser).toBeNull();
    expect(state.leads).toHaveLength(0);
    expect(state.messages).toHaveLength(0);
    expect(state.users).toHaveLength(0);
  });

  it('still clears the client when the logout request fails', async () => {
    useCrmStore.setState({
      currentUser: {
        id: 'u1',
        name: 'A',
        email: 'a@b.com',
        role: 'Admin',
        permissions: [],
        isLoggedIn: true,
      },
    });
    api.post.mockRejectedValue(new Error('offline'));

    await useCrmStore.getState().logout();

    expect(useCrmStore.getState().currentUser).toBeNull();
  });

  it('does not load workspace data while unauthenticated', async () => {
    const { fetchAllPages } = await import('../lib/api');
    useCrmStore.setState({ currentUser: null });

    await useCrmStore.getState().fetchInitialData();

    expect(fetchAllPages).not.toHaveBeenCalled();
  });
});
