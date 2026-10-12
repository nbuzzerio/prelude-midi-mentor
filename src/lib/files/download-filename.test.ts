import { describe, expect, it } from "vitest";
import { downloadFilename, formatDownloadNumber, sanitizeDownloadName, type DownloadExtension } from "./download-filename";

describe("manual download filenames", () => {
  it.each([
    ["Bells of Notre Dame", "bells_of_notre_dame"],
    ["Polyphonic Étude", "polyphonic_étude"],
    ["E\u0301tude 日本語", "étude_日本語"],
    ["अभ्यास", "अभ्यास"],
    ["../Bells\\of:Notre?Dame*", "bells_of_notre_dame"],
    ["__ bells -- of ... Notre __", "bells_of_notre"],
    ["Bells\u0000\u202e", "bells"],
    ["   ", "practice_session"],
    ["/?.\u0301", "practice_session"],
  ])("keeps %s recognizable and safe", (input, expected) => {
    expect(sanitizeDownloadName(input, "Practice Session")).toBe(expected);
  });
  it.each(["prelude.json", "json", "mid", "webm", "m4a", "ogg"] as DownloadExtension[])("preserves the exact %s extension with default 001", extension => {
    expect(downloadFilename("Bells of Notre Dame", extension, "export")).toBe(`bells_of_notre_dame_001.${extension}`);
  });
  it.each([["1", "001"], ["007", "007"], ["99", "099"], ["999", "999"]])("formats manually selected %s without a counter", (input, expected) => {
    expect(formatDownloadNumber(input)).toBe(expected);
    expect(downloadFilename("piece", "mid", "improv", input)).toBe(`piece_${expected}.mid`);
    expect(downloadFilename("piece", "mid", "improv")).toBe("piece_001.mid");
  });
  it.each(["", "0", "00", "000", "1000", "-1", "1.5", "1e2", "abc", "１２３"])("rejects reserved or invalid number %s", number => {
    expect(formatDownloadNumber(number)).toBeNull();
    expect(() => downloadFilename("piece", "json", "backup", number)).toThrow(/001 to 999/);
  });
  it("bounds long Unicode names without splitting a code point or truncating suffix/extension", () => {
    const name = sanitizeDownloadName("日本語".repeat(100), "piece");
    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(120);
    expect(name).not.toContain("\ufffd");
    expect(downloadFilename(name, "prelude.json", "piece", "999")).toMatch(/_999\.prelude\.json$/);
    expect(downloadFilename("CON", "json", "export")).toBe("con_001.json");
    expect(sanitizeDownloadName("???", "???")).toBe("export");
  });
});
