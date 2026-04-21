export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Returns true if `date` is a US non-holiday weekday (Mon–Fri, not a federal holiday).
 * Holiday enforcement is added by getUSFederalHolidays — wired in below.
 */
export function isNonHolidayWeekday(date: Date): boolean {
  const dow = date.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  const holidays = getUSFederalHolidays(date.getUTCFullYear());
  return !holidays.has(toDateStr(date));
}

// ---------------------------------------------------------------------------
// US Federal Holiday computation
// ---------------------------------------------------------------------------

function nthWeekdayOfMonth(year: number, month: number, n: number, dow: number): Date {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const firstDow = firstOfMonth.getUTCDay();
  const offset = (dow - firstDow + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

function lastWeekdayOfMonth(year: number, month: number, dow: number): Date {
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));
  const lastDow = lastOfMonth.getUTCDay();
  const offset = (lastDow - dow + 7) % 7;
  return new Date(Date.UTC(year, month, lastOfMonth.getUTCDate() - offset));
}

function observedDate(year: number, month: number, day: number): Date {
  const d = new Date(Date.UTC(year, month, day));
  const dow = d.getUTCDay();
  if (dow === 6) return new Date(Date.UTC(year, month, day - 1)); // Saturday → Friday
  if (dow === 0) return new Date(Date.UTC(year, month, day + 1)); // Sunday → Monday
  return d;
}

/**
 * Returns a Set of ISO date strings (YYYY-MM-DD) for all 11 US federal holidays
 * in the given year, adjusted to their observed dates.
 */
export function getUSFederalHolidays(year: number): Set<string> {
  const dates: Date[] = [
    observedDate(year, 11, 31),         // New Year's Eve — Dec 31
    observedDate(year, 0, 1),           // New Year's Day — Jan 1
    nthWeekdayOfMonth(year, 0, 3, 1),   // MLK Day — 3rd Monday of Jan
    nthWeekdayOfMonth(year, 1, 3, 1),   // Presidents' Day — 3rd Monday of Feb
    lastWeekdayOfMonth(year, 4, 1),     // Memorial Day — last Monday of May
    observedDate(year, 5, 19),          // Juneteenth — Jun 19
    observedDate(year, 6, 4),           // Independence Day — Jul 4
    nthWeekdayOfMonth(year, 8, 1, 1),   // Labor Day — 1st Monday of Sep
    nthWeekdayOfMonth(year, 9, 2, 1),   // Columbus Day — 2nd Monday of Oct
    observedDate(year, 10, 11),         // Veterans Day — Nov 11
    nthWeekdayOfMonth(year, 10, 4, 4),  // Thanksgiving — 4th Thursday of Nov
    observedDate(year, 11, 24),         // Christmas Eve — Dec 24
    observedDate(year, 11, 25),         // Christmas Day — Dec 25
    observedDate(year, 11, 26),         // Day after Christmas — Dec 26
  ];
  return new Set(dates.map(toDateStr));
}
