import { describe, expect, it } from "vitest";
import { printFilenameTitle } from "./print-filename";

describe("suggested print titles without PDF-save counters", () => {
  it.each([["Bells of Notre Dame", "bells_of_notre_dame_001"], ["Hallelujah", "hallelujah_001"], ["ÉTUDE / 日本語", "étude_日本語_001"], ["", "piece_001"]])("uses the piece title %s", (name, expected) => {
    expect(printFilenameTitle(name, "piece")).toBe(expected);
    expect(printFilenameTitle(name, "piece")).toBe(expected);
  });
  it.each([["Weekly Practice", "weekly_practice_report_001"], ["Weekly Practice Report", "weekly_practice_report_001"], ["Report", "report_001"], ["", "practice_session_report_001"]])("avoids duplicate report fragments for %s", (name, expected) => {
    expect(printFilenameTitle(name, "practice-session")).toBe(expected);
    expect(expected).not.toMatch(/\.pdf$/);
  });
});
