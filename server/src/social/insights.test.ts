import { describe, expect, it } from 'vitest';
import {
  engagementRate,
  mapFacebookMetrics,
  mapInstagramMetrics,
  mapLinkedInMetrics,
  mapXMetrics,
} from './insights.service';

/**
 * These mappers decide what each provider's payload means, and the decision
 * that matters in every one of them is the same: which absent field is a real
 * zero, and which is a metric the API does not have. Reporting the second as
 * zero would put a number on the screen that no platform ever measured — which
 * is precisely what the hardcoded panels this replaces were doing.
 */

describe('engagementRate', () => {
  it('divides engagements by reach, not impressions', () => {
    // 10 people saw it 40 times; 5 of them engaged. That is 50%, not 12.5%.
    const rate = engagementRate({ likes: 4, comments: 1, reach: 10, impressions: 40, unavailable: [] });

    expect(rate).toBeCloseTo(0.5);
  });

  it('counts every kind of engagement', () => {
    const rate = engagementRate({
      likes: 1,
      comments: 2,
      shares: 3,
      clicks: 4,
      reach: 100,
      unavailable: [],
    });

    expect(rate).toBeCloseTo(0.1);
  });

  it('is null when reach is unknown rather than assuming a denominator', () => {
    expect(engagementRate({ likes: 50, unavailable: [] })).toBeNull();
    expect(
      engagementRate({ likes: 50, impressions: 900, unavailable: ['reach: not reported'] })
    ).toBeNull();
  });

  it('is null rather than Infinity when reach is zero', () => {
    expect(engagementRate({ likes: 3, reach: 0, unavailable: [] })).toBeNull();
  });
});

describe('mapFacebookMetrics', () => {
  const counts = {
    likes: { summary: { total_count: 12 } },
    comments: { summary: { total_count: 3 } },
    shares: { count: 2 },
  };

  it('reads the engagement summaries and the insights', () => {
    const m = mapFacebookMetrics(counts, {
      data: [
        { name: 'post_impressions', values: [{ value: 900 }] },
        { name: 'post_impressions_unique', values: [{ value: 640 }] },
        { name: 'post_clicks', values: [{ value: 41 }] },
      ],
    });

    expect(m).toMatchObject({ likes: 12, comments: 3, shares: 2, impressions: 900, reach: 640, clicks: 41 });
    expect(m.unavailable).toEqual([]);
  });

  it('treats an absent share count as a measured zero', () => {
    // Graph omits the field when there are none and includes it when there are
    // any, so nothing is missing here.
    const m = mapFacebookMetrics({ ...counts, shares: undefined }, { data: [] });

    expect(m.shares).toBe(0);
  });

  it('keeps the counts when insights fail, and says why they are missing', () => {
    // A post minutes old has engagement counts but no insights row yet. Losing
    // the likes because of that would be worse than reporting no impressions.
    const m = mapFacebookMetrics(counts, { error: 'no insights for this post yet' });

    expect(m.likes).toBe(12);
    expect(m.impressions).toBeUndefined();
    expect(m.unavailable).toEqual(['impressions: no insights for this post yet']);
  });
});

describe('mapInstagramMetrics', () => {
  it('always reports shares as unavailable', () => {
    // The Instagram Graph API exposes no share count for a media object.
    const m = mapInstagramMetrics({ like_count: 88, comments_count: 7 }, { data: [] });

    expect(m.shares).toBeUndefined();
    expect(m.unavailable).toContain('shares: not reported by the Instagram Graph API');
  });

  it('reads reach from insights', () => {
    const m = mapInstagramMetrics(
      { like_count: 88, comments_count: 7 },
      {
        data: [
          { name: 'impressions', values: [{ value: 2400 }] },
          { name: 'reach', values: [{ value: 1900 }] },
        ],
      }
    );

    expect(m).toMatchObject({ likes: 88, comments: 7, impressions: 2400, reach: 1900 });
  });

  it('keeps the counts when insights fail', () => {
    const m = mapInstagramMetrics({ like_count: 88 }, { error: 'permission denied' });

    expect(m.likes).toBe(88);
    expect(m.reach).toBeUndefined();
    expect(m.unavailable).toContain('reach: permission denied');
  });
});

describe('mapLinkedInMetrics', () => {
  it('reads the summaries and is explicit about what needs another product', () => {
    const m = mapLinkedInMetrics({
      likesSummary: { totalLikes: 31 },
      commentsSummary: { aggregatedTotalComments: 4 },
    });

    expect(m).toMatchObject({ likes: 31, comments: 4 });
    expect(m.impressions).toBeUndefined();
    expect(m.unavailable).toHaveLength(2);
    expect(m.unavailable.join(' ')).toContain('Community Management');
  });
});

describe('mapXMetrics', () => {
  it('counts a quote as a share', () => {
    // A quote passes the post on with commentary. Counting retweets alone
    // undercounts how far it travelled.
    const m = mapXMetrics({
      like_count: 20,
      reply_count: 5,
      retweet_count: 7,
      quote_count: 3,
      impression_count: 5000,
    });

    expect(m).toMatchObject({ likes: 20, comments: 5, shares: 10, impressions: 5000 });
  });

  it('records a missing impression count as unavailable, not as zero', () => {
    const m = mapXMetrics({ like_count: 20, reply_count: 1, retweet_count: 0 });

    expect(m.impressions).toBeUndefined();
    expect(m.unavailable).toContain('impressions: not available on this post');
  });

  it('never claims a reach figure', () => {
    const m = mapXMetrics({ like_count: 1, impression_count: 10 });

    expect(m.reach).toBeUndefined();
    expect(m.unavailable.join(' ')).toContain('not unique reach');
    // And so engagement rate stays null rather than being computed off
    // impressions, which would flatter every X post.
    expect(engagementRate(m)).toBeNull();
  });
});
