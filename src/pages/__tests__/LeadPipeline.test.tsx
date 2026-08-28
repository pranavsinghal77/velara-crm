import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LeadPipeline from '../LeadPipeline';



// Mock the components that use heavy icons or sub-components if needed
vi.mock('../../store/useCrmStore', () => ({
  useCrmStore: vi.fn((selector) => {
    const state = {
      leads: [],
      addLead: vi.fn(),
      updateLead: vi.fn(),
      deleteLead: vi.fn(),
      setLeads: vi.fn()
    };
    return selector(state);
  })
}));

describe('LeadPipeline', () => {
  it('renders correctly', () => {
    render(
      <MemoryRouter>
        <LeadPipeline />
      </MemoryRouter>
    );
    expect(screen.getByText(/Lead Pipeline/i)).toBeInTheDocument();
  });
});
