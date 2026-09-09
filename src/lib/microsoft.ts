import { api } from './api';

/**
 * Client for the Microsoft 365 integration: Outlook mail, Teams meetings and
 * calendar. One OAuth connection per user; every call acts as the signed-in
 * user's own mailbox.
 */

export type MicrosoftStatus = 'Connected' | 'Expired' | 'Revoked' | 'Error';

export interface MicrosoftConnection {
  email: string;
  displayName: string | null;
  status: MicrosoftStatus;
  statusDetail: string | null;
  scopes: string[];
  connectedAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export interface MicrosoftState {
  /** False when the server holds no Azure app credentials. */
  configured: boolean;
  missingEnv: string[];
  encryptionAvailable: boolean;
  connection: MicrosoftConnection | null;
  capabilities: { mail: boolean; calendar: boolean; teams: boolean };
}

export interface CalendarEvent {
  id: string;
  subject: string;
  preview: string;
  start: string | null;
  end: string | null;
  timeZone: string | null;
  isAllDay: boolean;
  isTeams: boolean;
  joinUrl: string | null;
  webLink: string | null;
  location: string | null;
  attendees: string[];
  organizer: string | null;
}

export const microsoftApi = {
  status: () => api.get<MicrosoftState>('/microsoft/status'),

  /** Returns the Microsoft consent URL for the browser to navigate to. */
  connect: () => api.post<{ authorizeUrl: string }>('/microsoft/connect'),

  disconnect: () => api.delete<void>('/microsoft/connection'),

  sendMail: (input: {
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    html?: boolean;
    leadId?: string;
  }) => api.post<{ sent: boolean; recipients: number }>('/microsoft/mail', input),

  scheduleMeeting: (input: {
    subject: string;
    body?: string;
    /** Local date-time "YYYY-MM-DDTHH:mm"; interpreted in `timeZone`. */
    start: string;
    end: string;
    timeZone?: string;
    attendees?: { email: string; name?: string }[];
    teams?: boolean;
    leadId?: string;
  }) => api.post<CalendarEvent>('/microsoft/meetings', input),

  calendar: (from?: string, to?: string) =>
    api.get<{ from: string; to: string; timeZone: string; data: CalendarEvent[] }>(
      '/microsoft/calendar',
      { query: { from, to } }
    ),

  cancelMeeting: (id: string) => api.delete<void>(`/microsoft/meetings/${id}`),
};

/**
 * Reads the outcome the OAuth callback appended to the URL, then clears it so a
 * refresh does not repeat the message. Mirrors the social OAuth outcome reader.
 */
export function readMicrosoftOutcome(): { connected?: string; error?: string } | null {
  const params = new URLSearchParams(window.location.search);
  const connected = params.get('ms_connected');
  const error = params.get('ms_error');
  if (!connected && !error) return null;

  const clean = new URL(window.location.href);
  for (const key of ['ms_connected', 'ms_error']) clean.searchParams.delete(key);
  window.history.replaceState({}, '', clean.toString());

  return error ? { error } : { connected: connected ?? undefined };
}
