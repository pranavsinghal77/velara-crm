import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

vi.mock('../lib/realtime', () => ({
  connectRealtime: vi.fn(),
  disconnectRealtime: vi.fn(),
  isRealtimeConnected: () => false,
}));

const state = {
  currentUser: null as null | { role: string },
  isBootstrapping: false,
  bootstrap: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../store/useCrmStore', () => ({
  useCrmStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

describe('route protection', () => {
  it('sends an unauthenticated visitor to the login screen', async () => {
    state.currentUser = null;
    state.isBootstrapping = false;

    render(<App />);

    // The login form, not a dashboard, is what renders.
    await waitFor(() => expect(screen.getByLabelText(/email address/i)).toBeInTheDocument());
  });

  it('waits for the session check instead of flashing the login screen', () => {
    state.currentUser = null;
    state.isBootstrapping = true;

    render(<App />);

    expect(screen.getByText(/restoring your session|checking your session/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
  });
});
