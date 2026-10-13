import { describe, expect, it } from "vitest";
import { attributeProgramCalendarStart, formatProgramLocalDate, programCalendarWeek } from "./practice-program-calendar";
describe("Sunday-start program calendar", () => {
  it.each([
    [2026, 10, 11, "sunday", "2026-10-11"], [2026, 10, 17, "saturday", "2026-10-11"],
    [2026, 10, 18, "sunday", "2026-10-18"], [2026, 1, 1, "thursday", "2025-12-28"],
    [2024, 3, 1, "friday", "2024-02-25"], [2024, 2, 29, "thursday", "2024-02-25"],
    [2026, 3, 8, "sunday", "2026-03-08"], [2026, 11, 1, "sunday", "2026-11-01"],
  ] as const)("identifies %i/%i/%i without elapsed-millisecond arithmetic", (year, month, day, weekday, weekStartLocalDate) => {
    expect(programCalendarWeek({ year, month, day })).toEqual({ localDate: formatProgramLocalDate({ year, month, day }), weekday, weekStartLocalDate });
  });
  it("attributes DST offset changes to the same local week without allocating an attempt", () => {
    const before = attributeProgramCalendarStart({ year: 2026, month: 3, day: 8, utcStartedAtMs: Date.parse("2026-03-08T06:30:00Z"), timeZone: "America/New_York", utcOffsetMinutes: -300 });
    const after = attributeProgramCalendarStart({ year: 2026, month: 3, day: 8, utcStartedAtMs: Date.parse("2026-03-08T07:30:00Z"), timeZone: "America/New_York", utcOffsetMinutes: -240 });
    expect(after.weekStartLocalDate).toBe(before.weekStartLocalDate); expect(before.utcOffsetMinutes).toBe(-300); expect(after.utcOffsetMinutes).toBe(-240);
    expect(Object.keys(after)).not.toContain("attemptId");
  });
  it("preserves local-start attribution when the UTC date differs", () => {
    expect(attributeProgramCalendarStart({ year: 2026, month: 10, day: 17, utcStartedAtMs: Date.parse("2026-10-18T03:59:00Z"), timeZone: "America/New_York", utcOffsetMinutes: -240 })).toMatchObject({ localDate: "2026-10-17", weekday: "saturday", weekStartLocalDate: "2026-10-11", utcStartedAt: "2026-10-18T03:59:00.000Z" });
  });
  it.each([{ year: 2026, month: 2, day: 29 }, { year: 2026, month: 13, day: 1 }, { year: 2026, month: 1, day: 0 }, { year: 0, month: 1, day: 1 }, { year: 2026.5, month: 1, day: 1 }])("rejects invalid date %j", date => expect(() => formatProgramLocalDate(date)).toThrow());
  it("formats years below 100 without the Date constructor's 1900 remapping", () => {
    expect(formatProgramLocalDate({ year: 99, month: 2, day: 3 })).toBe("0099-02-03");
  });
  it("rejects invalid provenance and permits an unavailable IANA zone", () => {
    const input = { year: 2026, month: 10, day: 13, utcStartedAtMs: 0, timeZone: null, utcOffsetMinutes: 0 };
    expect(attributeProgramCalendarStart(input).timeZone).toBeNull();
    expect(() => attributeProgramCalendarStart({ ...input, utcOffsetMinutes: 900 })).toThrow();
    expect(() => attributeProgramCalendarStart({ ...input, utcStartedAtMs: NaN })).toThrow();
  });
});
