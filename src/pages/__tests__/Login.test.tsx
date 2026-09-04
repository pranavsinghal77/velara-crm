import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login';
import { ApiError } from '../../lib/api';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const login = vi.fn();
vi.mock('../../store/useCrmStore', () => ({
  useCrmStore: (selector: (s: Record<string, unknown>) => unknown) => selector({ login }),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe('Login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the typed credentials to the server and navigates on success', async () => {
    login.mockResolvedValue(undefined);
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email address/i), 'admin@velara.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'correct-horse-battery');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith('admin@velara.com', 'correct-horse-battery')
    );
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('shows the server message and stays put on bad credentials', async () => {
    login.mockRejectedValue(new ApiError(401, 'Invalid email or password', 'unauthorized'));
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email address/i), 'admin@velara.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('explains a rate limit rather than showing a raw 429', async () => {
    login.mockRejectedValue(new ApiError(429, 'Too many requests', 'rate_limited'));
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email address/i), 'admin@velara.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'guess-again-please');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/wait a few minutes/i);
  });

  it('does not call the API when a field is empty', async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email address/i), 'admin@velara.com');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // The required inputs block submission before the handler runs; the
    // in-handler guard is defence in depth for programmatic submits.
    expect(login).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('guards against a submit that reaches the handler with no password', async () => {
    renderLogin();

    // Bypass native validation the way a scripted submit would.
    screen.getByLabelText(/^password$/i).removeAttribute('required');
    await userEvent.type(screen.getByLabelText(/email address/i), 'admin@velara.com');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/enter your email and password/i);
    expect(login).not.toHaveBeenCalled();
  });

  it('hides the demo shortcuts unless the build flag is on', () => {
    renderLogin();
    expect(screen.queryByText(/demo accounts/i)).not.toBeInTheDocument();
  });
});
