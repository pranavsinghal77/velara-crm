import { describe, it, expect, beforeEach } from 'vitest';
import { useCrmStore } from './useCrmStore';

describe('useCrmStore', () => {
  beforeEach(() => {
    // Reset state before each test
    const store = useCrmStore.getState();
    store.setLeads([]);
  });

  it('adds a lead', () => {
    const store = useCrmStore.getState();
    expect(store.leads.length).toBe(0);

    store.addLead({
      id: 'test_lead_1',
      name: 'Test Lead',
      email: 'test@example.com',
      phone: '1234567890',
      source: 'Website',
      status: 'New',
      aiScore: 50,
      aiScoreBreakdown: { sourceQuality: 20, recency: 20, profileCompleteness: 10 },
      isHot: false,
      tags: [],
      notes: '',
      assignedTo: '',
      createdAt: '2026-01-01',
      lastContact: '2026-01-01'
    });

    const newStore = useCrmStore.getState();
    expect(newStore.leads.length).toBe(1);
    expect(newStore.leads[0].name).toBe('Test Lead');
  });

  it('deletes a lead', () => {
    const store = useCrmStore.getState();
    
    store.addLead({
      id: 'test_lead_1',
      name: 'Test Lead',
      email: 'test@example.com',
      phone: '1234567890',
      source: 'Website',
      status: 'New',
      aiScore: 50,
      aiScoreBreakdown: { sourceQuality: 20, recency: 20, profileCompleteness: 10 },
      isHot: false,
      tags: [],
      notes: '',
      assignedTo: '',
      createdAt: '2026-01-01',
      lastContact: '2026-01-01'
    });

    expect(useCrmStore.getState().leads.length).toBe(1);

    useCrmStore.getState().deleteLead('test_lead_1');

    expect(useCrmStore.getState().leads.length).toBe(0);
  });
});
