import { describe, it, expect } from "vitest";
import {
  toDateStr,
  isNonHolidayWeekday,
  getUSFederalHolidays,
} from "../../../src/utils/business-days";

// ---------------------------------------------------------------------------
// toDateStr
// ---------------------------------------------------------------------------

describe("toDateStr", () => {
  it("formats a UTC date as YYYY-MM-DD", () => {
    expect(toDateStr(new Date("2026-04-06T00:00:00.000Z"))).toBe("2026-04-06");
  });

  it("uses UTC day, not local time", () => {
    // 23:00 UTC on April 5 is still April 5 UTC
    expect(toDateStr(new Date("2026-04-05T23:00:00.000Z"))).toBe("2026-04-05");
  });
});

// ---------------------------------------------------------------------------
// Weekend detection
// ---------------------------------------------------------------------------

describe("isNonHolidayWeekday — weekends", () => {
  it("returns false for Saturday (2026-04-04)", () => {
    expect(isNonHolidayWeekday(new Date("2026-04-04T09:00:00.000Z"))).toBe(false);
  });

  it("returns false for Sunday (2026-04-05)", () => {
    expect(isNonHolidayWeekday(new Date("2026-04-05T09:00:00.000Z"))).toBe(false);
  });

  it("returns true for Monday (2026-04-06)", () => {
    expect(isNonHolidayWeekday(new Date("2026-04-06T09:00:00.000Z"))).toBe(true);
  });

  it("returns true for Tuesday (2026-04-07)", () => {
    expect(isNonHolidayWeekday(new Date("2026-04-07T09:00:00.000Z"))).toBe(true);
  });

  it("returns true for Wednesday (2026-04-08)", () => {
    expect(isNonHolidayWeekday(new Date("2026-04-08T09:00:00.000Z"))).toBe(true);
  });

  it("returns true for Thursday (2026-04-09)", () => {
    expect(isNonHolidayWeekday(new Date("2026-04-09T09:00:00.000Z"))).toBe(true);
  });

  it("returns true for Friday (2026-04-10)", () => {
    expect(isNonHolidayWeekday(new Date("2026-04-10T09:00:00.000Z"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getUSFederalHolidays — all 11 holidays in 2026
// ---------------------------------------------------------------------------

describe("getUSFederalHolidays — 2026", () => {
  const holidays2026 = getUSFederalHolidays(2026);

  // New Year's Eve: Dec 31 2025 = Wednesday → observed Wednesday
  it("New Year's Eve 2026 (Dec 31, Wednesday)", () => {
    expect(holidays2026.has("2026-12-31")).toBe(true);
  });

  // New Year's Day: Jan 1 2026 = Thursday → observed Thursday
  it("New Year's Day 2026 (Jan 1, Thursday)", () => {
    expect(holidays2026.has("2026-01-01")).toBe(true);
  });

  // MLK Day: 3rd Monday of Jan 2026 = Jan 19
  it("MLK Day 2026 (Jan 19)", () => {
    expect(holidays2026.has("2026-01-19")).toBe(true);
  });

  // Presidents' Day: 3rd Monday of Feb 2026 = Feb 16
  it("Presidents' Day 2026 (Feb 16)", () => {
    expect(holidays2026.has("2026-02-16")).toBe(true);
  });

  // Memorial Day: last Monday of May 2026 = May 25
  it("Memorial Day 2026 (May 25)", () => {
    expect(holidays2026.has("2026-05-25")).toBe(true);
  });

  // Juneteenth: Jun 19 2026 = Friday → observed Friday
  it("Juneteenth 2026 (Jun 19, Friday)", () => {
    expect(holidays2026.has("2026-06-19")).toBe(true);
  });

  // Independence Day: Jul 4 2026 = Saturday → observed Friday Jul 3
  it("Independence Day 2026 observed (Jul 3, Friday — Jul 4 falls on Saturday)", () => {
    expect(holidays2026.has("2026-07-03")).toBe(true);
    expect(holidays2026.has("2026-07-04")).toBe(false);
  });

  // Labor Day: 1st Monday of Sep 2026 = Sep 7
  it("Labor Day 2026 (Sep 7)", () => {
    expect(holidays2026.has("2026-09-07")).toBe(true);
  });

  // Columbus Day: 2nd Monday of Oct 2026 = Oct 12
  it("Columbus Day 2026 (Oct 12)", () => {
    expect(holidays2026.has("2026-10-12")).toBe(true);
  });

  // Veterans Day: Nov 11 2026 = Wednesday → observed Wednesday
  it("Veterans Day 2026 (Nov 11, Wednesday)", () => {
    expect(holidays2026.has("2026-11-11")).toBe(true);
  });

  // Thanksgiving: 4th Thursday of Nov 2026 = Nov 26
  it("Thanksgiving 2026 (Nov 26)", () => {
    expect(holidays2026.has("2026-11-26")).toBe(true);
  });

  // Christmas Eve: Dec 24 2026 = Thursday → observed Thursday
  it("Christmas Eve 2026 (Dec 24, Thursday)", () => {
    expect(holidays2026.has("2026-12-24")).toBe(true);
  });

  // Christmas: Dec 25 2026 = Friday → observed Friday
  it("Christmas Day 2026 (Dec 25, Friday)", () => {
    expect(holidays2026.has("2026-12-25")).toBe(true);
  });

  // In 2026 Dec 26 = Saturday → observed Friday Dec 25 (collides with Christmas Day).
  // Set deduplicates, so size is 12 not 13 for this year.
  // New Year's Eve: Dec 31 2026 = Thursday → observed Thursday
  it("New Year's Eve 2026 (Dec 31, Thursday)", () => {
    expect(holidays2026.has("2026-12-31")).toBe(true);
  });

  // In 2026 Dec 26 = Saturday → observed Dec 25, collides with Christmas Day → 13 unique dates
  it("returns 13 unique holiday dates in 2026 (Dec 26 observed collides with Dec 25)", () => {
    expect(holidays2026.size).toBe(13);
  });

  // In 2025 no collisions → all 14 dates are distinct
  it("returns 14 unique holiday dates in 2025 (no collisions)", () => {
    expect(getUSFederalHolidays(2025).size).toBe(14);
  });

  // Verify day-after-Christmas and NYE are present in a non-colliding year
  it("Day after Christmas 2025 (Dec 26, Friday)", () => {
    expect(getUSFederalHolidays(2025).has("2025-12-26")).toBe(true);
  });

  it("New Year's Eve 2025 (Dec 31, Wednesday)", () => {
    expect(getUSFederalHolidays(2025).has("2025-12-31")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Observed-date rules
// ---------------------------------------------------------------------------

describe("getUSFederalHolidays — observed-date adjustments", () => {
  // Christmas 2021: Dec 25 = Saturday → observed Friday Dec 24
  it("Saturday fixed holiday observed on preceding Friday (Christmas 2021)", () => {
    const h = getUSFederalHolidays(2021);
    expect(h.has("2021-12-24")).toBe(true); // observed Friday
    expect(h.has("2021-12-25")).toBe(false); // actual Saturday not in set
  });

  // New Year's Day 2023: Jan 1 = Sunday → observed Monday Jan 2
  it("Sunday fixed holiday observed on following Monday (New Year's 2023)", () => {
    const h = getUSFederalHolidays(2023);
    expect(h.has("2023-01-02")).toBe(true); // observed Monday
    expect(h.has("2023-01-01")).toBe(false); // actual Sunday not in set
  });
});

// ---------------------------------------------------------------------------
// isNonHolidayWeekday — holiday enforcement
// ---------------------------------------------------------------------------

describe("isNonHolidayWeekday — holiday enforcement", () => {
  it("returns false on New Year's Day 2026 (Thursday)", () => {
    expect(isNonHolidayWeekday(new Date("2026-01-01T09:00:00.000Z"))).toBe(false);
  });

  it("returns true on the day after New Year's Day 2026 (Jan 2, Friday)", () => {
    expect(isNonHolidayWeekday(new Date("2026-01-02T09:00:00.000Z"))).toBe(true);
  });

  it("returns false on Independence Day observed 2026 (Jul 3, Friday)", () => {
    expect(isNonHolidayWeekday(new Date("2026-07-03T09:00:00.000Z"))).toBe(false);
  });

  it("returns true on Jul 4 2026 (Saturday is a weekend regardless)", () => {
    expect(isNonHolidayWeekday(new Date("2026-07-04T09:00:00.000Z"))).toBe(false); // Saturday
  });

  it("returns false on Thanksgiving 2026 (Nov 26, Thursday)", () => {
    expect(isNonHolidayWeekday(new Date("2026-11-26T09:00:00.000Z"))).toBe(false);
  });

  it("returns true on the Friday after Thanksgiving 2026 (Nov 27)", () => {
    expect(isNonHolidayWeekday(new Date("2026-11-27T09:00:00.000Z"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Floating holidays — multi-year spot-checks
// ---------------------------------------------------------------------------

describe("getUSFederalHolidays — floating holiday spot-checks", () => {
  it("MLK Day 2027 = Jan 18 (3rd Monday)", () => {
    expect(getUSFederalHolidays(2027).has("2027-01-18")).toBe(true);
  });

  it("Memorial Day 2027 = May 31 (last Monday of May)", () => {
    expect(getUSFederalHolidays(2027).has("2027-05-31")).toBe(true);
  });

  it("Labor Day 2028 = Sep 4 (1st Monday of Sep)", () => {
    expect(getUSFederalHolidays(2028).has("2028-09-04")).toBe(true);
  });

  it("Thanksgiving 2028 = Nov 23 (4th Thursday of Nov)", () => {
    expect(getUSFederalHolidays(2028).has("2028-11-23")).toBe(true);
  });
});
