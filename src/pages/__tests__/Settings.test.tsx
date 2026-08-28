import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../Settings';


vi.mock('../../store/useCrmStore', () => ({
  useCrmStore: vi.fn((selector) => {
    const state = {
      users: [],
      integrations: [],
      preferences: {}
    };
    return selector(state);
  })
}));

describe('Settings', () => {
  it('renders correctly and shows tabs', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText(/Users & Team/i)).toBeInTheDocument();
  });
});
