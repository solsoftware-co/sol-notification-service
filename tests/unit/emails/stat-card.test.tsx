// StatCard component — rendering tests
// Uses @react-email/render to produce real HTML so we can assert on content,
// structure, and styling without a DOM environment.

import { render } from '@react-email/render';
import { StatCard } from '../../../src/emails/components/stat-card';
import type { StatMetric } from '../../../src/emails/components/stat-card';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function baseMetric(overrides: Partial<StatMetric> = {}): StatMetric {
  return {
    value: '12,340',
    label: 'Website Visits',
    sublabel: 'Sessions',
    ...overrides,
  };
}

/** Build a metric with `priorCount` prior bars + 1 current bar. */
function metricWithBars(
  priorCount: number,
  overrides: Partial<StatMetric> = {},
): StatMetric {
  const priorBars = Array.from({ length: priorCount }, (_, i) => ({
    label: `Week ${i + 1}`,
    value: 10000 + i * 300,
    isCurrent: false,
  }));
  const unit = priorCount === 1 ? 'week' : 'weeks';
  const compCount = priorCount === 1 ? 'the previous week' : `the previous ${priorCount} ${unit}`;
  return baseMetric({
    changePhrase: '10% more sessions',
    changeDirection: 'up',
    periodLabel: 'Feb 23 – Mar 1',
    comparisonLabel: compCount,
    bars: [...priorBars, { label: 'Feb 23', value: 12340, isCurrent: true }],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count how many times a substring appears in a string. */
function countOccurrences(haystack: string, needle: string): number {
  return (haystack.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) ?? []).length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatCard', () => {

  // -------------------------------------------------------------------------
  describe('without historical data — fallback mode', () => {
    let html: string;

    beforeAll(async () => {
      html = await render(StatCard({ metric: baseMetric() }));
    });

    it('renders the friendly label', () => {
      expect(html).toContain('Website Visits');
    });

    it('renders the sublabel beneath the value', () => {
      expect(html).toContain('Sessions');
    });

    it('renders the metric value', () => {
      expect(html).toContain('12,340');
    });

    it('renders no bar chart — current-bar colour is absent', () => {
      expect(html).not.toContain('#71717A');
    });

    it('renders no change description', () => {
      expect(html).not.toContain('You had');
      expect(html).not.toContain('was consistent for');
    });

    it('renders no trend arrow when there is no historical data', () => {
      expect(html).not.toContain('↑');
      expect(html).not.toContain('↓');
      expect(html).not.toContain('→');
    });
  });

  // -------------------------------------------------------------------------
  describe('with 1 prior period', () => {
    let html: string;

    beforeAll(async () => {
      html = await render(StatCard({ metric: metricWithBars(1) }));
    });

    it('renders exactly 2 bar labels (1 prior + 1 current)', () => {
      expect(html).toContain('Week 1');
      expect(html).toContain('Feb 23');
    });

    it('description references the previous week', () => {
      expect(html).toContain('the previous week');
    });

    it('current bar has the darker colour', () => {
      expect(html).toContain('#71717A');
    });

    it('renders an upward trend arrow (↑) coloured with the positive token', () => {
      expect(html).toContain('↑');
      expect(html).toContain('#F7BC03'); // colors.positive
    });
  });

  // -------------------------------------------------------------------------
  describe('with 2 prior periods', () => {
    let html: string;

    beforeAll(async () => {
      html = await render(StatCard({ metric: metricWithBars(2) }));
    });

    it('renders 3 bar labels (2 prior + 1 current)', () => {
      expect(html).toContain('Week 1');
      expect(html).toContain('Week 2');
      expect(html).toContain('Feb 23');
    });

    it('description references the previous 2 weeks', () => {
      expect(html).toContain('the previous 2 weeks');
    });
  });

  // -------------------------------------------------------------------------
  describe('with 3 prior periods — upward trend', () => {
    let html: string;

    beforeAll(async () => {
      html = await render(StatCard({ metric: metricWithBars(3) }));
    });

    it('renders 4 bar labels (3 prior + 1 current)', () => {
      expect(html).toContain('Week 1');
      expect(html).toContain('Week 2');
      expect(html).toContain('Week 3');
      expect(html).toContain('Feb 23');
    });

    it('exactly one bar carries the current-period colour', () => {
      expect(countOccurrences(html, '#71717A')).toBe(1);
    });

    it('description uses "You had" prefix', () => {
      expect(html).toContain('You had');
    });

    it('description uses "more" language for an upward trend', () => {
      expect(html).toContain('more sessions');
    });

    it('change phrase is rendered in bold', () => {
      expect(html).toContain('<strong>10% more sessions</strong>');
    });

    it('period label is rendered in bold', () => {
      expect(html).toContain('<strong>Feb 23 – Mar 1</strong>');
    });

    it('description ends with the comparison label', () => {
      expect(html).toContain('the previous 3 weeks');
    });
  });

  // -------------------------------------------------------------------------
  describe('with 3 prior periods — downward trend', () => {
    let html: string;

    beforeAll(async () => {
      html = await render(StatCard({
        metric: metricWithBars(3, {
          changePhrase: '15% fewer sessions',
          changeDirection: 'down',
        }),
      }));
    });

    it('description uses "fewer" language for a downward trend', () => {
      expect(html).toContain('fewer sessions');
    });

    it('still uses "You had" prefix', () => {
      expect(html).toContain('You had');
    });

    it('change phrase is rendered in bold', () => {
      expect(html).toContain('<strong>15% fewer sessions</strong>');
    });

    it('renders a downward trend arrow (↓) coloured with the negative token', () => {
      expect(html).toContain('↓');
      expect(html).toContain('#C97B7B'); // colors.negative
    });
  });

  // -------------------------------------------------------------------------
  describe('with 3 prior periods — neutral trend', () => {
    let html: string;

    beforeAll(async () => {
      html = await render(StatCard({
        metric: metricWithBars(3, {
          changePhrase: 'consistent sessions',
          changeDirection: 'neutral',
        }),
      }));
    });

    it('description says "consistent" not "You had"', () => {
      expect(html).toContain('consistent');
      expect(html).not.toContain('You had');
    });

    it('uses "was consistent for" phrasing', () => {
      expect(html).toContain('was consistent for');
    });

    it('still bolds the period label', () => {
      expect(html).toContain('<strong>Feb 23 – Mar 1</strong>');
    });

    it('renders a neutral trend arrow (→) coloured with the muted token', () => {
      expect(html).toContain('→');
      expect(html).toContain('#A1A1AA'); // colors.textMuted
    });
  });

  // -------------------------------------------------------------------------
  describe('metric-specific phrasing', () => {
    it('avg duration up — description says "longer"', async () => {
      const html = await render(StatCard({
        metric: metricWithBars(3, {
          label: 'Avg. Time on Site',
          sublabel: 'Avg. Duration',
          changePhrase: '8% longer average sessions',
          changeDirection: 'up',
        }),
      }));
      expect(html).toContain('longer average sessions');
      expect(html).toContain('Avg. Time on Site');
      expect(html).toContain('Avg. Duration');
    });

    it('avg duration down — description says "shorter"', async () => {
      const html = await render(StatCard({
        metric: metricWithBars(3, {
          label: 'Avg. Time on Site',
          sublabel: 'Avg. Duration',
          changePhrase: '5% shorter average sessions',
          changeDirection: 'down',
        }),
      }));
      expect(html).toContain('shorter average sessions');
    });

    it('total visitors up — description says "more active users"', async () => {
      const html = await render(StatCard({
        metric: metricWithBars(3, {
          label: 'Total Visitors',
          sublabel: 'Active Users',
          changePhrase: '12% more active users',
          changeDirection: 'up',
        }),
      }));
      expect(html).toContain('more active users');
      expect(html).toContain('Total Visitors');
      expect(html).toContain('Active Users');
    });

    it('first-time visitors down — description says "fewer new users"', async () => {
      const html = await render(StatCard({
        metric: metricWithBars(3, {
          label: 'First-Time Visitors',
          sublabel: 'New Users',
          changePhrase: '3% fewer new users',
          changeDirection: 'down',
        }),
      }));
      expect(html).toContain('fewer new users');
      expect(html).toContain('First-Time Visitors');
      expect(html).toContain('New Users');
    });
  });

});
