import { isNonHolidayWeekday } from "./business-days";

export function localDateStr(tz: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function next9amInTimezone(tz: string, from: Date = new Date()): Date {
  const dateStr = localDateStr(tz, from);
  // Construct a UTC moment representing 09:00:00 on the local calendar date
  const naiveUtc = new Date(`${dateStr}T09:00:00.000Z`);
  // Find the local hour at that naive UTC moment to compute the true UTC offset
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).formatToParts(naiveUtc);
  const localHour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  // Shift by the difference to land exactly on 09:00:00 local clock time
  const candidate = new Date(naiveUtc.getTime() + (9 - localHour) * 3_600_000);
  // If already at or past 9 AM local, return 9 AM the following calendar day
  if (candidate <= from) {
    return new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  return candidate;
}

export function isNonHolidayWeekdayInTz(date: Date, tz: string): boolean {
  const localStr = localDateStr(tz, date);
  // Treat the local date string as a UTC date so that getUTCDay() and toISOString()
  // reflect the client's local calendar — matching the contract expected by isNonHolidayWeekday
  const localDateAsUtc = new Date(`${localStr}T00:00:00Z`);
  return isNonHolidayWeekday(localDateAsUtc);
}
