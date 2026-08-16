// T006 + T009: buildAnalyticsExcel and buildExcelFilename unit tests
// Uses the real xlsx library — no mocking needed (pure in-memory transformation)

import * as XLSX from 'xlsx';
import { describe, it, expect } from 'vitest';
import { buildAnalyticsExcel, buildExcelFilename } from '../../../src/lib/excel';
import type { AnalyticsReport, ClientRecord, ResolvedPeriod } from '../../../src/types/index';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockClient: ClientRecord = {
  id: 'acme',
  name: 'Acme Corp',
  email: 'hello@acmecorp.com',
  ga4_property_id: '123456789',
  active: true,
  settings: {},
  created_at: new Date(),
};

const mockPeriod: ResolvedPeriod = {
  start: '2026-02-16',
  end: '2026-02-22',
  label: 'Feb 16 – Feb 22, 2026',
  preset: 'last_week',
};

const mockReport: AnalyticsReport = {
  sessions: 4820,
  activeUsers: 3200,
  newUsers: 540,
  avgSessionDurationSecs: 185,
  topPages: [
    { path: '/', views: 3000 },
    { path: '/about', views: 800 },
  ],
  topSources: [
    { source: 'google', sessions: 2100 },
    { source: 'direct', sessions: 1400 },
  ],
  dailyMetrics: [
    { date: '2026-02-16', sessions: 680, activeUsers: 450, newUsers: 80 },
    { date: '2026-02-17', sessions: 710, activeUsers: 470, newUsers: 85 },
  ],
  resolvedPeriod: mockPeriod,
  isMock: true,
};

const mockReportWithHistory: AnalyticsReport = {
  ...mockReport,
  historicalPeriods: [
    {
      periodLabel: 'Feb 9',
      periodStart: '2026-02-09',
      sessions: 4100,
      activeUsers: 2800,
      newUsers: 480,
      avgSessionDurationSecs: 170,
    },
    {
      periodLabel: 'Feb 2',
      periodStart: '2026-02-02',
      sessions: 3900,
      activeUsers: 2600,
      newUsers: 460,
      avgSessionDurationSecs: 160,
    },
  ],
};

// ---------------------------------------------------------------------------
// buildExcelFilename
// ---------------------------------------------------------------------------

describe('buildExcelFilename', () => {
  it('produces correct filename for standard client name and period', () => {
    expect(buildExcelFilename(mockClient, mockPeriod)).toBe(
      'analytics-acme-corp-2026-02-16-2026-02-22.xlsx',
    );
  });

  it('strips non-alphanumeric characters from client name', () => {
    const client = { ...mockClient, name: 'Acme & Sons, LLC.' };
    expect(buildExcelFilename(client, mockPeriod)).toBe(
      'analytics-acme--sons-llc-2026-02-16-2026-02-22.xlsx',
    );
  });

  it('lowercases client name', () => {
    const client = { ...mockClient, name: 'UPPERCASE CLIENT' };
    expect(buildExcelFilename(client, mockPeriod)).toBe(
      'analytics-uppercase-client-2026-02-16-2026-02-22.xlsx',
    );
  });
});

// ---------------------------------------------------------------------------
// buildAnalyticsExcel — output type
// ---------------------------------------------------------------------------

describe('buildAnalyticsExcel — output', () => {
  it('returns a Buffer', async () => {
    const buf = await buildAnalyticsExcel(mockReport, mockClient, mockPeriod);
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it('returns a non-empty Buffer', async () => {
    const buf = await buildAnalyticsExcel(mockReport, mockClient, mockPeriod);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('returns a parseable xlsx workbook', async () => {
    const buf = await buildAnalyticsExcel(mockReport, mockClient, mockPeriod);
    expect(() => XLSX.read(buf)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// buildAnalyticsExcel — sheet structure (no historical)
// ---------------------------------------------------------------------------

describe('buildAnalyticsExcel — 4-sheet workbook (no historical)', () => {
  it('contains exactly 4 sheets when historicalPeriods is absent', async () => {
    const buf = await buildAnalyticsExcel(mockReport, mockClient, mockPeriod);
    const wb = XLSX.read(buf);
    expect(wb.SheetNames).toHaveLength(4);
  });

  it('has the correct sheet names in order', async () => {
    const buf = await buildAnalyticsExcel(mockReport, mockClient, mockPeriod);
    const wb = XLSX.read(buf);
    expect(wb.SheetNames).toEqual(['Summary', 'Top Pages', 'Traffic Sources', 'Daily Breakdown']);
  });

  it('Top Pages sheet has header + one row per topPage entry', async () => {
    const buf = await buildAnalyticsExcel(mockReport, mockClient, mockPeriod);
    const wb = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Top Pages'], { header: 1 }) as unknown[][];
    expect(rows).toHaveLength(mockReport.topPages.length + 1); // header + data
    expect(rows[0]).toEqual(['Page Path', 'Page Views']);
    expect(rows[1]).toEqual(['/', 3000]);
  });

  it('Traffic Sources sheet has header + one row per source entry', async () => {
    const buf = await buildAnalyticsExcel(mockReport, mockClient, mockPeriod);
    const wb = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Traffic Sources'], { header: 1 }) as unknown[][];
    expect(rows).toHaveLength(mockReport.topSources.length + 1);
    expect(rows[0]).toEqual(['Source', 'Sessions']);
    expect(rows[1]).toEqual(['google', 2100]);
  });

  it('Daily Breakdown sheet has header + one row per daily metric', async () => {
    const buf = await buildAnalyticsExcel(mockReport, mockClient, mockPeriod);
    const wb = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Daily Breakdown'], { header: 1 }) as unknown[][];
    expect(rows).toHaveLength(mockReport.dailyMetrics.length + 1);
    expect(rows[0]).toEqual(['Date', 'Sessions', 'Active Users', 'New Users']);
  });

  it('Summary sheet contains period label in first row', async () => {
    const buf = await buildAnalyticsExcel(mockReport, mockClient, mockPeriod);
    const wb = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Summary'], { header: 1 }) as unknown[][];
    expect(rows[0]).toEqual(['Report Period', 'Feb 16 – Feb 22, 2026']);
    expect(rows[2]).toEqual(['Total Sessions', 4820]);
  });
});

// ---------------------------------------------------------------------------
// buildAnalyticsExcel — empty data (edge case)
// ---------------------------------------------------------------------------

describe('buildAnalyticsExcel — empty arrays', () => {
  it('returns a valid Buffer even when topPages, topSources, dailyMetrics are empty', async () => {
    const emptyReport: AnalyticsReport = {
      ...mockReport,
      topPages: [],
      topSources: [],
      dailyMetrics: [],
    };
    const buf = await buildAnalyticsExcel(emptyReport, mockClient, mockPeriod);
    expect(Buffer.isBuffer(buf)).toBe(true);
    const wb = XLSX.read(buf);
    expect(wb.SheetNames).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// T009: buildAnalyticsExcel — Historical sheet (US2)
// ---------------------------------------------------------------------------

describe('buildAnalyticsExcel — Historical sheet present', () => {
  it('contains 5 sheets when historicalPeriods is non-empty and preset is not custom', async () => {
    const buf = await buildAnalyticsExcel(mockReportWithHistory, mockClient, mockPeriod);
    const wb = XLSX.read(buf);
    expect(wb.SheetNames).toHaveLength(5);
    expect(wb.SheetNames[4]).toBe('Historical');
  });

  it('Historical sheet has header + one row per snapshot + "Current Period" row', async () => {
    const buf = await buildAnalyticsExcel(mockReportWithHistory, mockClient, mockPeriod);
    const wb = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Historical'], { header: 1 }) as unknown[][];
    const expectedRows = mockReportWithHistory.historicalPeriods!.length + 2; // header + snapshots + current
    expect(rows).toHaveLength(expectedRows);
    expect(rows[0]).toEqual(['Period', 'Sessions', 'Active Users', 'New Users', 'Avg Session Duration']);
    expect(rows[rows.length - 1][0]).toBe('Current Period');
  });
});

describe('buildAnalyticsExcel — Historical sheet absent', () => {
  it('omits Historical sheet when preset is "custom" even if historicalPeriods is populated', async () => {
    const customPeriod: ResolvedPeriod = { ...mockPeriod, preset: 'custom' };
    const buf = await buildAnalyticsExcel(mockReportWithHistory, mockClient, customPeriod);
    const wb = XLSX.read(buf);
    expect(wb.SheetNames).toHaveLength(4);
    expect(wb.SheetNames).not.toContain('Historical');
  });

  it('omits Historical sheet when historicalPeriods is an empty array', async () => {
    const reportNoHistory: AnalyticsReport = { ...mockReport, historicalPeriods: [] };
    const buf = await buildAnalyticsExcel(reportNoHistory, mockClient, mockPeriod);
    const wb = XLSX.read(buf);
    expect(wb.SheetNames).toHaveLength(4);
    expect(wb.SheetNames).not.toContain('Historical');
  });

  it('omits Historical sheet when historicalPeriods is undefined', async () => {
    const buf = await buildAnalyticsExcel(mockReport, mockClient, mockPeriod);
    const wb = XLSX.read(buf);
    expect(wb.SheetNames).toHaveLength(4);
    expect(wb.SheetNames).not.toContain('Historical');
  });
});
