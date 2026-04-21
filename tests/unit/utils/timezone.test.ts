import { localDateStr, next9amInTimezone, isNonHolidayWeekdayInTz } from "../../../src/utils/timezone";

// ---------------------------------------------------------------------------
// localDateStr
// ---------------------------------------------------------------------------

describe("localDateStr", () => {
  it("returns local date in ET winter — midnight UTC Feb 2 is still Feb 1 in ET (EST UTC-5)", () => {
    const d = new Date("2026-02-02T00:00:00.000Z");
    expect(localDateStr("America/New_York", d)).toBe("2026-02-01");
  });

  it("returns local date in PT winter — midnight UTC Feb 2 is still Feb 1 in PT (PST UTC-8)", () => {
    const d = new Date("2026-02-02T00:00:00.000Z");
    expect(localDateStr("America/Los_Angeles", d)).toBe("2026-02-01");
  });

  it("returns same calendar date for CT at noon UTC in February (CST UTC-6 → 6 AM local)", () => {
    const d = new Date("2026-02-02T12:00:00.000Z");
    expect(localDateStr("America/Chicago", d)).toBe("2026-02-02");
  });

  it("handles DST — ET summer (EDT UTC-4), noon UTC is still same calendar date", () => {
    const d = new Date("2026-07-02T12:00:00.000Z");
    expect(localDateStr("America/New_York", d)).toBe("2026-07-02");
  });

  it("returns YYYY-MM-DD format with zero-padded month and day", () => {
    const d = new Date("2026-01-05T12:00:00.000Z");
    expect(localDateStr("America/Chicago", d)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// next9amInTimezone — all four US timezones, winter (standard time)
// ---------------------------------------------------------------------------

describe("next9amInTimezone — winter standard time", () => {
  // Cron fires midnight UTC on the 2nd; in US timezones midnight UTC is late
  // afternoon/evening of the previous day, so next9am lands on Feb 2 local.

  it("ET winter (EST UTC-5): returns 14:00 UTC = 9 AM ET", () => {
    const from = new Date("2026-02-02T00:00:00.000Z");
    expect(next9amInTimezone("America/New_York", from).toISOString()).toBe(
      "2026-02-02T14:00:00.000Z"
    );
  });

  it("CT winter (CST UTC-6): returns 15:00 UTC = 9 AM CT", () => {
    const from = new Date("2026-02-02T00:00:00.000Z");
    expect(next9amInTimezone("America/Chicago", from).toISOString()).toBe(
      "2026-02-02T15:00:00.000Z"
    );
  });

  it("MT winter (MST UTC-7): returns 16:00 UTC = 9 AM MT", () => {
    const from = new Date("2026-02-02T00:00:00.000Z");
    expect(next9amInTimezone("America/Denver", from).toISOString()).toBe(
      "2026-02-02T16:00:00.000Z"
    );
  });

  it("PT winter (PST UTC-8): returns 17:00 UTC = 9 AM PT", () => {
    const from = new Date("2026-02-02T00:00:00.000Z");
    expect(next9amInTimezone("America/Los_Angeles", from).toISOString()).toBe(
      "2026-02-02T17:00:00.000Z"
    );
  });
});

// ---------------------------------------------------------------------------
// next9amInTimezone — DST (summer, daylight saving time)
// ---------------------------------------------------------------------------

describe("next9amInTimezone — summer daylight saving time", () => {
  it("ET summer (EDT UTC-4): returns 13:00 UTC = 9 AM ET", () => {
    const from = new Date("2026-07-02T00:00:00.000Z");
    expect(next9amInTimezone("America/New_York", from).toISOString()).toBe(
      "2026-07-02T13:00:00.000Z"
    );
  });

  it("PT summer (PDT UTC-7): returns 16:00 UTC = 9 AM PT", () => {
    const from = new Date("2026-07-02T00:00:00.000Z");
    expect(next9amInTimezone("America/Los_Angeles", from).toISOString()).toBe(
      "2026-07-02T16:00:00.000Z"
    );
  });
});

// ---------------------------------------------------------------------------
// next9amInTimezone — already-past and at-exact-9am cases
// ---------------------------------------------------------------------------

describe("next9amInTimezone — past and boundary cases", () => {
  it("advances to next day when from is 30 minutes past 9 AM ET", () => {
    // 14:30 UTC = 9:30 AM ET (past 9 AM) → next 9 AM ET is Feb 3
    const from = new Date("2026-02-02T14:30:00.000Z");
    expect(next9amInTimezone("America/New_York", from).toISOString()).toBe(
      "2026-02-03T14:00:00.000Z"
    );
  });

  it("advances to next day when from is exactly at 9 AM ET", () => {
    const from = new Date("2026-02-02T14:00:00.000Z");
    expect(next9amInTimezone("America/New_York", from).toISOString()).toBe(
      "2026-02-03T14:00:00.000Z"
    );
  });

  it("returns same-day 9 AM when from is before 9 AM local", () => {
    // 10:00 UTC = 5 AM ET (before 9 AM) → returns 9 AM ET same day
    const from = new Date("2026-02-02T10:00:00.000Z");
    expect(next9amInTimezone("America/New_York", from).toISOString()).toBe(
      "2026-02-02T14:00:00.000Z"
    );
  });
});

// ---------------------------------------------------------------------------
// isNonHolidayWeekdayInTz
// ---------------------------------------------------------------------------

describe("isNonHolidayWeekdayInTz", () => {
  it("returns true for a Monday in ET (9 AM ET Feb 2, 2026)", () => {
    const d = new Date("2026-02-02T14:00:00.000Z");
    expect(isNonHolidayWeekdayInTz(d, "America/New_York")).toBe(true);
  });

  it("returns false for a Saturday in ET (9 AM ET Apr 4, 2026)", () => {
    const d = new Date("2026-04-04T13:00:00.000Z");
    expect(isNonHolidayWeekdayInTz(d, "America/New_York")).toBe(false);
  });

  it("returns false for a Sunday in PT (9 AM PT Apr 5, 2026)", () => {
    // Apr 5, 2026 = Sunday; 9 AM PDT (UTC-7) = 16:00 UTC
    const d = new Date("2026-04-05T16:00:00.000Z");
    expect(isNonHolidayWeekdayInTz(d, "America/Los_Angeles")).toBe(false);
  });

  it("uses local calendar date — same UTC moment is Monday in ET but Sunday in PT", () => {
    // 04:00 UTC Apr 6, 2026:
    //   ET (EDT UTC-4): midnight ET Apr 6 (Monday) → true
    //   PT (PDT UTC-7): 9 PM Apr 5 (Sunday) → false
    const d = new Date("2026-04-06T04:00:00.000Z");
    expect(isNonHolidayWeekdayInTz(d, "America/New_York")).toBe(true);
    expect(isNonHolidayWeekdayInTz(d, "America/Los_Angeles")).toBe(false);
  });

  it("returns false for MLK Day (3rd Monday of Jan) in ET", () => {
    // MLK Day 2026 = Jan 19; 9 AM EST = 14:00 UTC
    const d = new Date("2026-01-19T14:00:00.000Z");
    expect(isNonHolidayWeekdayInTz(d, "America/New_York")).toBe(false);
  });

  it("returns false for Christmas Day in PT", () => {
    // Dec 25, 2026 = Friday; 9 AM PST = 17:00 UTC
    const d = new Date("2026-12-25T17:00:00.000Z");
    expect(isNonHolidayWeekdayInTz(d, "America/Los_Angeles")).toBe(false);
  });

  it("returns false for Thanksgiving in CT", () => {
    // Thanksgiving 2026 = Nov 26 (4th Thursday of Nov); 9 AM CST = 15:00 UTC
    const d = new Date("2026-11-26T15:00:00.000Z");
    expect(isNonHolidayWeekdayInTz(d, "America/Chicago")).toBe(false);
  });
});
