export const PROGRAM_WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export type ProgramCalendarAttribution = Readonly<{
  localDate: string; weekStartLocalDate: string; weekday: (typeof PROGRAM_WEEKDAYS)[number];
  utcStartedAt: string; timeZone: string | null; utcOffsetMinutes: number;
}>;
type CalendarDate = Readonly<{ year: number; month: number; day: number }>;
function dateOf(value: CalendarDate) {
  const date = new Date(0); date.setUTCHours(12, 0, 0, 0); date.setUTCFullYear(value.year, value.month - 1, value.day);
  if (!Number.isInteger(value.year) || value.year < 1 || value.year > 9999 || date.getUTCFullYear() !== value.year
    || date.getUTCMonth() + 1 !== value.month || date.getUTCDate() !== value.day) throw Error("Invalid local calendar date.");
  return date;
}
export function formatProgramLocalDate(value: CalendarDate): string {
  dateOf(value); return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}
export function programCalendarWeek(value: CalendarDate) {
  const date = dateOf(value), weekday = PROGRAM_WEEKDAYS[date.getUTCDay()];
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return { localDate: formatProgramLocalDate(value), weekday,
    weekStartLocalDate: formatProgramLocalDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }) };
}
/** Caller injects the local date/zone/offset at a future attempt boundary; allocates no attempt. */
export function attributeProgramCalendarStart(input: CalendarDate & Readonly<{ utcStartedAtMs: number; timeZone: string | null; utcOffsetMinutes: number }>): ProgramCalendarAttribution {
  if (!Number.isFinite(input.utcStartedAtMs) || !Number.isInteger(input.utcOffsetMinutes) || Math.abs(input.utcOffsetMinutes) > 840
    || input.timeZone !== null && (typeof input.timeZone !== "string" || !input.timeZone.trim())) throw Error("Invalid calendar provenance.");
  const utcStartedAt = new Date(input.utcStartedAtMs).toISOString();
  return { ...programCalendarWeek(input), utcStartedAt, timeZone: input.timeZone, utcOffsetMinutes: input.utcOffsetMinutes };
}
