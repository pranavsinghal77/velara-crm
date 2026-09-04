import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, Users, MessageSquare, Phone, FileText, MapPin, Trophy, Zap, LifeBuoy, BarChart3, Settings, Plus, Receipt, Sparkles, ArrowRight, Command } from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

interface CommandPaletteProps {
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Leads' | 'Quick Actions';
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
  action: () => void;
}

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const leads = useCrmStore((s) => s.leads);

  // Focusing the DOM node is a genuine external-system effect; the state
  // reset that used to live here is handled by mounting fresh.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Navigation Items
  const navItems: CommandItem[] = useMemo(
    () => [
      {
        id: 'nav-dashboard',
        title: 'Dashboard',
        subtitle: 'Executive KPIs, revenue metrics & morning brief',
        category: 'Navigation',
        icon: LayoutDashboard,
        action: () => {
          navigate('/dashboard');
          onClose();
        },
      },
      {
        id: 'nav-leads',
        title: 'Lead Pipeline & Kanban Desk',
        subtitle: 'Manage stages, Indian Rupee pipeline & AI scoring',
        category: 'Navigation',
        icon: Users,
        action: () => {
          navigate('/leads');
          onClose();
        },
      },
      {
        id: 'nav-inbox',
        title: 'Unified Inbox',
        subtitle: 'WhatsApp, SMS, Email & ZeroBT Frustration Radar',
        category: 'Navigation',
        icon: MessageSquare,
        action: () => {
          navigate('/inbox');
          onClose();
        },
      },
      {
        id: 'nav-calling',
        title: 'Calling Center & Smart Dialer',
        subtitle: 'VoIP & GSM dialer with real-time AI transcription',
        category: 'Navigation',
        icon: Phone,
        action: () => {
          navigate('/calling');
          onClose();
        },
      },
      {
        id: 'nav-documents',
        title: 'Documents & GST Proposals',
        subtitle: 'Contracts, KYC, and 1-Click 18% GST Quotations',
        category: 'Navigation',
        icon: FileText,
        action: () => {
          navigate('/documents');
          onClose();
        },
      },
      {
        id: 'nav-support',
        title: 'Support Command & ZeroBT Copilot',
        subtitle: 'Multi-tier escalation dossiers & Knowledge Base RAG',
        category: 'Navigation',
        icon: LifeBuoy,
        action: () => {
          navigate('/support');
          onClose();
        },
      },
      {
        id: 'nav-fieldops',
        title: 'Field Operations & Visual Compliance',
        subtitle: 'Store check-ins, beat routes & Gemini store audit',
        category: 'Navigation',
        icon: MapPin,
        action: () => {
          navigate('/fieldops');
          onClose();
        },
      },
      {
        id: 'nav-leaderboard',
        title: 'Sales Leaderboard',
        subtitle: 'Rep revenue targets, streaks & performance radar',
        category: 'Navigation',
        icon: Trophy,
        action: () => {
          navigate('/leaderboard');
          onClose();
        },
      },
      {
        id: 'nav-workflows',
        title: 'Workflow Studio',
        subtitle: 'Trigger-Action automated sequences and reminders',
        category: 'Navigation',
        icon: Zap,
        action: () => {
          navigate('/workflows');
          onClose();
        },
      },
      {
        id: 'nav-analytics',
        title: 'Analytics & Churn Radar',
        subtitle: 'Conversion velocity, touchpoints & pipeline health',
        category: 'Navigation',
        icon: BarChart3,
        action: () => {
          navigate('/analytics');
          onClose();
        },
      },
      {
        id: 'nav-settings',
        title: 'Settings & Integrations',
        subtitle: 'WhatsApp API, Tally ERP 9, IndiaMART & JustDial keys',
        category: 'Navigation',
        icon: Settings,
        action: () => {
          navigate('/settings');
          onClose();
        },
      },
    ],
    [navigate, onClose]
  );

  // Quick Actions
  const actionItems: CommandItem[] = useMemo(
    () => [
      {
        id: 'act-add-lead',
        title: 'Add New Lead',
        subtitle: 'Create a new B2B lead with automatic AI score calculation',
        category: 'Quick Actions',
        icon: Plus,
        badge: 'Lead Desk',
        badgeColor: 'bg-blue-100 text-blue-800',
        action: () => {
          navigate('/leads');
          onClose();
        },
      },
      {
        id: 'act-gst-quote',
        title: 'Generate GST Proforma Quotation',
        subtitle: 'Create 18% CGST/SGST invoice with annual discounts',
        category: 'Quick Actions',
        icon: Receipt,
        badge: 'Finance',
        badgeColor: 'bg-emerald-100 text-emerald-800',
        action: () => {
          navigate('/documents');
          onClose();
        },
      },
      {
        id: 'act-ai-chat',
        title: 'Open Velara AI Copilot',
        subtitle: 'Ask questions, query leads, or get deal recommendations',
        category: 'Quick Actions',
        icon: Sparkles,
        badge: 'Gemini AI',
        badgeColor: 'bg-purple-100 text-purple-800',
        action: () => {
          window.dispatchEvent(new CustomEvent('velara:assistant-open'));
          onClose();
        },
      },
    ],
    [navigate, onClose]
  );

  // Lead Items
  const leadItems: CommandItem[] = useMemo(() => {
    return leads.slice(0, 8).map((l) => ({
      id: `lead-${l.id}`,
      title: l.name,
      subtitle: `${l.company || 'Individual'} • ${l.source} • ${l.budget || '₹2L'}`,
      category: 'Leads' as const,
      icon: Users,
      badge: `Score: ${l.aiScore}`,
      badgeColor: l.aiScore > 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
      action: () => {
        navigate('/leads');
        onClose();
      },
    }));
  }, [leads, navigate, onClose]);

  // Combined and filtered items
  const filteredItems = useMemo(() => {
    const all = [...actionItems, ...navItems, ...leadItems];
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(
      (item) => item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [actionItems, navItems, leadItems, query]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredItems, selectedIndex, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-[12vh] p-4 overlay-enter">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-xl overflow-hidden flex flex-col max-h-[70vh] modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, page, or search leads..."
            className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
          />
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded shadow-2xs font-mono">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-1 flex-1 stagger stagger-tight">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No results found for &ldquo;<span className="font-semibold text-slate-600">{query}</span>&rdquo;
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected ? 'bg-blue-50 text-blue-900 shadow-2xs' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs truncate">{item.title}</span>
                        {item.badge && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${item.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</p>}
                    </div>
                  </div>

                  <ArrowRight size={13} className={`shrink-0 transition-opacity ${isSelected ? 'opacity-100 text-blue-600' : 'opacity-0'}`} />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↑</kbd>{' '}
              <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↵</kbd> Select
            </span>
          </div>
          <span className="flex items-center gap-1 text-slate-500 font-medium">
            <Command size={11} /> Universal Palette
          </span>
        </div>
      </div>
    </div>
  );
}
