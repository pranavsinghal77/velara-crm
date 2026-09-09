import { describe, expect, it } from 'vitest';
import { buildEventPayload, buildMailPayload, mapEvent, MS_SCOPES } from './graph.service';

/**
 * These builders turn a CRM request into the exact JSON Microsoft Graph
 * expects. The costly mistakes here are silent: a body sent as HTML when it was
 * meant as text renders someone's plain message as markup, and a start time
 * with a stray offset lands a meeting an hour out. Both are shape decisions, so
 * both are tested as pure functions.
 */

describe('buildMailPayload', () => {
  it('wraps recipients in Graph\'s emailAddress shape and saves to Sent Items', () => {
    const p = buildMailPayload({
      to: ['a@x.com', 'b@x.com'],
      subject: 'Quote',
      body: 'Attached.',
    }) as { message: Record<string, unknown>; saveToSentItems: boolean };

    expect(p.message.toRecipients).toEqual([
      { emailAddress: { address: 'a@x.com' } },
      { emailAddress: { address: 'b@x.com' } },
    ]);
    // A sent email the sender cannot find later looks like it never went.
    expect(p.saveToSentItems).toBe(true);
  });

  it('defaults to plain text, and only sends HTML when asked', () => {
    const text = buildMailPayload({ to: ['a@x.com'], subject: 's', body: '<b>hi</b>' }) as {
      message: { body: { contentType: string; content: string } };
    };
    // A message with angle brackets must not become markup by default.
    expect(text.message.body.contentType).toBe('Text');

    const html = buildMailPayload({ to: ['a@x.com'], subject: 's', body: '<b>hi</b>', html: true }) as {
      message: { body: { contentType: string } };
    };
    expect(html.message.body.contentType).toBe('HTML');
  });

  it('omits cc entirely when there is none', () => {
    const p = buildMailPayload({ to: ['a@x.com'], subject: 's', body: 'b' }) as {
      message: Record<string, unknown>;
    };
    expect(p.message).not.toHaveProperty('ccRecipients');
  });
});

describe('buildEventPayload', () => {
  const base = {
    subject: 'Discovery call',
    start: '2026-09-10T15:00:00',
    end: '2026-09-10T15:30:00',
    timeZone: 'Asia/Kolkata',
  };

  it('sends the local time and the timezone separately, as Graph requires', () => {
    const p = buildEventPayload(base) as {
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
    };
    // The dateTime carries no offset; the zone lives in its own field. Baking an
    // offset into the dateTime would double-apply against timeZone.
    expect(p.start).toEqual({ dateTime: '2026-09-10T15:00:00', timeZone: 'Asia/Kolkata' });
    expect(p.end.timeZone).toBe('Asia/Kolkata');
  });

  it('attaches a Teams meeting only when asked', () => {
    const without = buildEventPayload(base);
    expect(without).not.toHaveProperty('isOnlineMeeting');

    const withTeams = buildEventPayload({ ...base, teams: true }) as {
      isOnlineMeeting: boolean;
      onlineMeetingProvider: string;
    };
    expect(withTeams.isOnlineMeeting).toBe(true);
    expect(withTeams.onlineMeetingProvider).toBe('teamsForBusiness');
  });

  it('maps attendees to required participants', () => {
    const p = buildEventPayload({
      ...base,
      attendees: [{ email: 'lead@acme.com', name: 'A Lead' }],
    }) as { attendees: { emailAddress: { address: string; name?: string }; type: string }[] };

    expect(p.attendees[0]).toEqual({
      emailAddress: { address: 'lead@acme.com', name: 'A Lead' },
      type: 'required',
    });
  });

  it('omits attendees and body when absent rather than sending empty ones', () => {
    const p = buildEventPayload(base);
    expect(p).not.toHaveProperty('attendees');
    expect(p).not.toHaveProperty('body');
  });
});

describe('mapEvent', () => {
  it('flattens a Teams meeting to the join url and the essentials', () => {
    const e = mapEvent({
      id: 'evt1',
      subject: 'Demo',
      start: { dateTime: '2026-09-10T15:00:00.0000000', timeZone: 'Asia/Kolkata' },
      end: { dateTime: '2026-09-10T15:30:00.0000000', timeZone: 'Asia/Kolkata' },
      isOnlineMeeting: true,
      onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup/xyz' },
      attendees: [{ emailAddress: { address: 'lead@acme.com' } }],
      organizer: { emailAddress: { address: 'me@velara.com' } },
    });

    expect(e).toMatchObject({
      id: 'evt1',
      subject: 'Demo',
      isTeams: true,
      joinUrl: 'https://teams.microsoft.com/l/meetup/xyz',
      attendees: ['lead@acme.com'],
      organizer: 'me@velara.com',
    });
  });

  it('does not invent a join url for a non-online event', () => {
    const e = mapEvent({ id: 'evt2', subject: 'Desk work', isOnlineMeeting: false, onlineMeeting: null });
    expect(e.isTeams).toBe(false);
    expect(e.joinUrl).toBeNull();
  });

  it('gives a subjectless event a readable placeholder', () => {
    expect(mapEvent({ id: 'e' }).subject).toBe('(no subject)');
  });
});

describe('scopes', () => {
  it('requests exactly the delegated permissions the three features need', () => {
    // offline_access is the one that is easy to forget and, without it, there
    // is no refresh token and the connection dies after an hour.
    expect(MS_SCOPES).toContain('offline_access');
    expect(MS_SCOPES).toContain('Mail.Send');
    expect(MS_SCOPES).toContain('Calendars.ReadWrite');
    expect(MS_SCOPES).toContain('OnlineMeetings.ReadWrite');
  });
});
