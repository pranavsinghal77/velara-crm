import { api } from './api';

/**
 * Client for Apollo.io lead sourcing.
 *
 * Search previews candidates; import creates the chosen ones as leads. The
 * shapes mirror what the server returns, including the parts that say a
 * candidate is not fully usable — `emailLocked` and `alreadyImported` are the
 * two the UI needs to be honest with, so it never implies a contactable email
 * that Apollo has not revealed, nor lets a plan slot be spent re-importing
 * someone the workspace already holds.
 */

export interface ApolloConfig {
  configured: boolean;
  enabled: boolean;
  lastImportAt: string | null;
  importedTotal: number;
  encryptionAvailable: boolean;
}

export interface ApolloCandidate {
  sourceRef: string;
  name: string;
  email: string;
  emailLocked: boolean;
  phone: string;
  company?: string;
  designation?: string;
  city?: string;
  linkedinUrl?: string;
  notes: string;
  alreadyImported: boolean;
}

export interface ApolloSearchFilters {
  titles?: string[];
  locations?: string[];
  organizationDomains?: string[];
  /** Apollo employee-range strings, e.g. "1,10" or "201,500". */
  employeeRanges?: string[];
  keywords?: string;
  page?: number;
  perPage?: number;
}

export interface ApolloSearchResult {
  data: ApolloCandidate[];
  pagination: { page: number; totalPages: number; totalEntries: number };
  summary: { returned: number; newToWorkspace: number; emailLocked: number };
}

export interface ApolloImportResult {
  imported: number;
  leads: { id: string; name: string; sourceRef: string }[];
  skippedDuplicate: number;
  failed: number;
  failures: { name: string; reason: string }[];
  limitReached: boolean;
  message: string;
}

export const apolloApi = {
  config: () => api.get<ApolloConfig>('/apollo/config'),

  /** Store (or, with `null`, clear) the workspace's Apollo key. Admin only. */
  saveKey: (apiKey: string | null, enabled?: boolean) =>
    api.put<{ configured: boolean; enabled: boolean; keyHint?: string }>('/apollo/config', {
      apiKey,
      enabled,
    }),

  test: () =>
    api.post<{ ok: boolean; reachable: boolean; sampleTotal?: number; error?: string }>(
      '/apollo/test',
      {}
    ),

  search: (filters: ApolloSearchFilters) =>
    api.post<ApolloSearchResult>('/apollo/search', filters),

  /** Re-runs the same search server-side and imports the named person ids. */
  import: (filters: ApolloSearchFilters, personIds: string[]) =>
    api.post<ApolloImportResult>('/apollo/import', { ...filters, personIds }),
};
