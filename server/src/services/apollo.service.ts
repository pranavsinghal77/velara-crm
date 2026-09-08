import { prisma } from '../config/db';
import { env } from '../config/env';
import { decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';
import type { CreateLeadFields } from './leadWrite.service';

/**
 * Apollo.io lead sourcing.
 *
 * Two halves, deliberately kept apart: the HTTP calls to Apollo, and the pure
 * functions that decide what a returned record *means*. The mapping is where
 * the honesty lives — Apollo's people search returns a locked placeholder email
 * for any contact you have not spent a credit to reveal, and storing
 * `email_not_unlocked@domain.com` as a lead's email address would be a lie the
 * rest of the CRM then acts on. So that is detected and dropped, and the lead
 * is flagged as awaiting an email rather than given a fake one.
 *
 * The pure half has no network or database and is unit-tested directly.
 */

const APOLLO_BASE = env.APOLLO_API_BASE.replace(/\/+$/, '');
const SEARCH_PATH = '/api/v1/mixed_people/search';
const TIMEOUT_MS = 20_000;

// ── Types mirroring the slice of Apollo's response we use ──

export interface ApolloOrganization {
  name?: string;
  website_url?: string;
  primary_domain?: string;
}

export interface ApolloPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  headline?: string;
  email?: string | null;
  /** Apollo's own label: "verified", "guessed", "unavailable", "locked", null. */
  email_status?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  organization?: ApolloOrganization | null;
  phone_numbers?: { raw_number?: string; sanitized_number?: string }[] | null;
}

export interface ApolloSearchResponse {
  people?: ApolloPerson[];
  pagination?: { page?: number; per_page?: number; total_entries?: number; total_pages?: number };
}

export interface ApolloSearchFilters {
  titles?: string[];
  locations?: string[];
  organizationDomains?: string[];
  employeeRanges?: string[];
  keywords?: string;
  page?: number;
  perPage?: number;
}

/** A search result mapped to CRM shape, before any decision to import it. */
export interface LeadCandidate {
  /** Apollo person id, the dedup key. */
  sourceRef: string;
  name: string;
  email: string;
  /** True when Apollo returned a locked/placeholder email rather than a real one. */
  emailLocked: boolean;
  phone: string;
  company?: string;
  designation?: string;
  city?: string;
  linkedinUrl?: string;
  notes: string;
}

// ── Pure: what a record means ──

/**
 * Apollo hands back a placeholder for any email you have not revealed with a
 * credit. It takes a few forms — a literal `email_not_unlocked@domain.com`, an
 * empty value, or an `email_status` that is not a real one — and every one of
 * them means "no usable email", not "this is the address".
 */
export function isUsableEmail(email: string | null | undefined, status?: string | null): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (!e || !e.includes('@')) return false;
  if (e.includes('email_not_unlocked') || e.includes('not_unlocked') || e.startsWith('email_')) {
    return false;
  }
  // Apollo only vouches for an address it marks verified or guessed; locked and
  // unavailable are exactly the ones that come with a placeholder.
  if (status && !['verified', 'guessed', 'extrapolated'].includes(status.toLowerCase())) {
    return false;
  }
  return true;
}

/** Best display name from the parts Apollo provides. */
export function personName(person: ApolloPerson): string {
  const joined = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
  return (person.name?.trim() || joined || 'Unknown contact').slice(0, 200);
}

/**
 * Maps one Apollo person to a lead candidate.
 *
 * Nothing is invented. A missing company stays undefined rather than becoming
 * "Unknown Co", the AI score is left for the CRM's own scorer rather than
 * fabricated here, and a locked email becomes an empty string with the flag
 * set, so the caller and the UI can be honest that the address still needs
 * revealing.
 */
export function mapPerson(person: ApolloPerson): LeadCandidate | null {
  // Without an id there is no dedup key, and a person Apollo cannot identify is
  // not worth importing.
  if (!person.id) return null;

  const usable = isUsableEmail(person.email, person.email_status);
  const phone =
    person.phone_numbers?.find((p) => p.sanitized_number || p.raw_number)?.sanitized_number ??
    person.phone_numbers?.find((p) => p.raw_number)?.raw_number ??
    '';

  const noteParts = [
    person.headline || person.title,
    person.organization?.website_url || person.organization?.primary_domain,
    person.linkedin_url,
  ].filter((v): v is string => Boolean(v));

  return {
    sourceRef: person.id,
    name: personName(person),
    email: usable ? person.email!.trim() : '',
    emailLocked: !usable,
    phone,
    company: person.organization?.name?.trim() || undefined,
    designation: person.title?.trim() || undefined,
    city: person.city?.trim() || undefined,
    linkedinUrl: person.linkedin_url ?? undefined,
    notes: noteParts.join(' · '),
  };
}

/** A candidate, turned into the shared write service's input shape. */
export function candidateToLead(candidate: LeadCandidate): CreateLeadFields {
  return {
    name: candidate.name,
    // The write service requires an email; a locked one is stored empty and the
    // note records that it is pending, rather than writing a fake address.
    email: candidate.email,
    phone: candidate.phone,
    source: 'Apollo',
    company: candidate.company,
    designation: candidate.designation,
    city: candidate.city,
    tags: candidate.emailLocked ? ['apollo', 'email-pending'] : ['apollo'],
    notes: candidate.emailLocked
      ? [candidate.notes, 'Email locked in Apollo — reveal it there before outreach.']
          .filter(Boolean)
          .join(' — ')
      : candidate.notes,
  };
}

/**
 * Builds Apollo's search body from our filter shape.
 *
 * Only the keys the caller actually set are sent: Apollo treats an empty array
 * and an absent key differently, and sending empty filters narrows nothing but
 * bloats the request.
 */
export function buildSearchBody(filters: ApolloSearchFilters): Record<string, unknown> {
  const body: Record<string, unknown> = {
    page: Math.max(1, filters.page ?? 1),
    per_page: Math.min(100, Math.max(1, filters.perPage ?? 25)),
  };
  if (filters.titles?.length) body.person_titles = filters.titles;
  if (filters.locations?.length) body.person_locations = filters.locations;
  if (filters.organizationDomains?.length) body.q_organization_domains = filters.organizationDomains.join('\n');
  if (filters.employeeRanges?.length) body.organization_num_employees_ranges = filters.employeeRanges;
  if (filters.keywords?.trim()) body.q_keywords = filters.keywords.trim();
  return body;
}

// ── HTTP: talking to Apollo ──

export interface ApolloError extends Error {
  status?: number;
}

function apolloError(status: number, message: string): ApolloError {
  const err = new Error(message) as ApolloError;
  err.status = status;
  return err;
}

/**
 * Calls Apollo's people search. Surfaces Apollo's own error text rather than a
 * generic failure, because the fixes differ: 401 is a bad key, 403 is a plan
 * that does not include the API, 422 is a malformed filter, 429 is rate/credit
 * exhaustion.
 */
export async function searchPeople(
  apiKey: string,
  filters: ApolloSearchFilters
): Promise<{ people: ApolloPerson[]; total: number; page: number; totalPages: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${APOLLO_BASE}${SEARCH_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        // Apollo authenticates the request by this header.
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(buildSearchBody(filters)),
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => null)) as
      | (ApolloSearchResponse & { error?: string; error_message?: string })
      | null;

    if (!res.ok) {
      const message =
        data?.error_message ??
        data?.error ??
        (res.status === 401
          ? 'Apollo rejected the API key.'
          : res.status === 403
            ? 'This Apollo plan does not include API access to people search.'
            : res.status === 429
              ? 'Apollo rate limit or credit allowance reached. Try again later.'
              : `Apollo returned HTTP ${res.status}.`);
      throw apolloError(res.status, message);
    }

    return {
      people: data?.people ?? [],
      total: data?.pagination?.total_entries ?? 0,
      page: data?.pagination?.page ?? filters.page ?? 1,
      totalPages: data?.pagination?.total_pages ?? 1,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw apolloError(504, 'Apollo did not respond in time.');
    }
    if (err instanceof TypeError) {
      throw apolloError(502, 'Could not reach Apollo (network error).');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** The decrypted Apollo key for a tenant, or null when none is stored/usable. */
export async function resolveApolloKey(
  orgId: string
): Promise<{ key: string; enabled: boolean } | { key: null; reason: string }> {
  const config = await prisma.apolloConfig.findUnique({ where: { orgId } });
  if (!config) return { key: null, reason: 'No Apollo API key is configured for this workspace.' };
  if (!config.enabled) return { key: null, reason: 'Apollo sourcing is switched off for this workspace.' };

  try {
    return { key: decrypt(config.apiKeyEnc), enabled: config.enabled };
  } catch (err) {
    logger.error('Apollo key could not be decrypted', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { key: null, reason: 'The stored Apollo key could not be read. Re-enter it in Settings.' };
  }
}
