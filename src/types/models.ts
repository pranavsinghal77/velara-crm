// ─── Lead ────────────────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: 'JustDial' | 'IndiaMART' | 'Website' | 'WhatsApp' | 'Referral';
  status: 'New' | 'Contacted' | 'Qualified' | 'Negotiation' | 'Won' | 'Lost';
  aiScore: number;
  aiScoreBreakdown: {
    sourceQuality: number;
    recency: number;
    profileCompleteness: number;
  };
  lastContact: string;
  isHot: boolean;
  tags: string[];
  notes: string;
  assignedTo: string;
  createdAt: string;
  company?: string;
  designation?: string;
  city?: string;
  budget?: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'Admin' | 'Manager' | 'Sales' | 'Viewer';
  isActive: boolean;
  avatar?: string;
  permissions: string[];
}

// ─── Message ──────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  leadId: string;
  content: string;
  sender: 'sent' | 'received';
  timestamp: string;
  channel: 'WhatsApp' | 'Email' | 'SMS';
  isRead: boolean;
  isAISuggested: boolean;
}

// ─── Reminder ─────────────────────────────────────────────────────────────────

export interface Reminder {
  id: string;
  leadId: string;
  leadName: string;
  task: string;
  dueDate: string;
  dueTime: string;
  isToday: boolean;
  isTomorrow: boolean;
  isCompleted: boolean;
  priority: 'High' | 'Medium' | 'Low';
  type: 'Manual' | 'AI-Generated';
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'lead' | 'reminder' | 'ai' | 'system';
  isRead: boolean;
  timestamp: string;
}

// ─── AIInsight ────────────────────────────────────────────────────────────────

export interface AIInsight {
  id: string;
  leadId: string;
  insight: string;
  action: string;
  confidence: number;
  timestamp: string;
}

// ─── AuthUser ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Sales' | 'Viewer';
  isLoggedIn: boolean;
}
