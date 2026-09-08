import { describe, expect, it } from 'vitest';
import {
  buildSearchBody,
  candidateToLead,
  isUsableEmail,
  mapPerson,
  personName,
  type ApolloPerson,
} from './apollo.service';

/**
 * The mapping is where an Apollo response becomes a claim the CRM will act on,
 * so the decision that matters most is which "email" is real. Apollo returns a
 * placeholder for any contact you have not spent a credit to reveal, and
 * storing that placeholder as a lead's address would send outreach into a
 * black hole — the exact kind of fabricated data the rest of this codebase
 * refuses to keep.
 */

describe('isUsableEmail', () => {
  it('accepts a real, verified address', () => {
    expect(isUsableEmail('priya@sharmatextiles.com', 'verified')).toBe(true);
    expect(isUsableEmail('arun@keralalogistics.co.in', 'guessed')).toBe(true);
  });

  it('rejects Apollo\'s locked placeholder in every form it takes', () => {
    expect(isUsableEmail('email_not_unlocked@domain.com', 'locked')).toBe(false);
    expect(isUsableEmail('email_not_unlocked@domain.com', null)).toBe(false);
    expect(isUsableEmail(null, null)).toBe(false);
    expect(isUsableEmail('', 'verified')).toBe(false);
    expect(isUsableEmail(undefined, undefined)).toBe(false);
  });

  it('rejects an address Apollo will not vouch for', () => {
    // A status of "unavailable" ships alongside a placeholder, so the address
    // beside it is not to be trusted even if it looks well-formed.
    expect(isUsableEmail('someone@company.com', 'unavailable')).toBe(false);
  });

  it('rejects anything without an @', () => {
    expect(isUsableEmail('not-an-email', 'verified')).toBe(false);
  });
});

describe('personName', () => {
  it('prefers the full name, falls back to the parts, then to a placeholder', () => {
    expect(personName({ name: 'Priya Sharma' })).toBe('Priya Sharma');
    expect(personName({ first_name: 'Arun', last_name: 'Nair' })).toBe('Arun Nair');
    expect(personName({})).toBe('Unknown contact');
  });
});

describe('mapPerson', () => {
  const verified: ApolloPerson = {
    id: 'apollo-1',
    first_name: 'Priya',
    last_name: 'Sharma',
    name: 'Priya Sharma',
    title: 'Head of Procurement',
    email: 'priya@sharmatextiles.com',
    email_status: 'verified',
    city: 'Surat',
    linkedin_url: 'https://linkedin.com/in/priya',
    organization: { name: 'Sharma Textiles', website_url: 'https://sharmatextiles.com' },
    phone_numbers: [{ sanitized_number: '+919812345678' }],
  };

  it('maps a fully-revealed contact into a lead candidate', () => {
    const c = mapPerson(verified)!;
    expect(c).toMatchObject({
      sourceRef: 'apollo-1',
      name: 'Priya Sharma',
      email: 'priya@sharmatextiles.com',
      emailLocked: false,
      phone: '+919812345678',
      company: 'Sharma Textiles',
      designation: 'Head of Procurement',
      city: 'Surat',
    });
  });

  it('drops a locked email and flags it rather than storing the placeholder', () => {
    const c = mapPerson({
      ...verified,
      email: 'email_not_unlocked@domain.com',
      email_status: 'locked',
    })!;
    expect(c.email).toBe('');
    expect(c.emailLocked).toBe(true);
    // The rest of the record is still worth having.
    expect(c.name).toBe('Priya Sharma');
    expect(c.company).toBe('Sharma Textiles');
  });

  it('returns null for a person with no id, which cannot be deduped', () => {
    expect(mapPerson({ name: 'No Id', email: 'x@y.com' })).toBeNull();
  });

  it('invents nothing for missing fields', () => {
    const c = mapPerson({ id: 'apollo-2', name: 'Bare Contact' })!;
    expect(c.company).toBeUndefined();
    expect(c.designation).toBeUndefined();
    expect(c.city).toBeUndefined();
    expect(c.phone).toBe('');
  });
});

describe('candidateToLead', () => {
  it('tags a locked-email lead and records that outreach must wait', () => {
    const lead = candidateToLead({
      sourceRef: 'a1',
      name: 'Priya Sharma',
      email: '',
      emailLocked: true,
      phone: '',
      notes: 'Head of Procurement',
    });
    expect(lead.email).toBe('');
    expect(lead.source).toBe('Apollo');
    expect(lead.tags).toContain('email-pending');
    expect(lead.notes).toMatch(/locked in Apollo/i);
  });

  it('does not add the pending tag when the email is real', () => {
    const lead = candidateToLead({
      sourceRef: 'a2',
      name: 'Arun Nair',
      email: 'arun@keralalogistics.co.in',
      emailLocked: false,
      phone: '',
      notes: '',
    });
    expect(lead.tags).toEqual(['apollo']);
    expect(lead.email).toBe('arun@keralalogistics.co.in');
  });
});

describe('buildSearchBody', () => {
  it('always sends page and per_page, clamped to Apollo limits', () => {
    expect(buildSearchBody({})).toMatchObject({ page: 1, per_page: 25 });
    expect(buildSearchBody({ page: 0, perPage: 999 })).toMatchObject({ page: 1, per_page: 100 });
  });

  it('omits filters that were not set rather than sending empty ones', () => {
    // Apollo narrows on an empty array differently from an absent key, so an
    // unset filter must not appear at all.
    const body = buildSearchBody({ titles: ['Founder'] });
    expect(body.person_titles).toEqual(['Founder']);
    expect(body).not.toHaveProperty('person_locations');
    expect(body).not.toHaveProperty('q_keywords');
  });

  it('joins organization domains the way Apollo expects', () => {
    const body = buildSearchBody({ organizationDomains: ['a.com', 'b.com'] });
    expect(body.q_organization_domains).toBe('a.com\nb.com');
  });
});
