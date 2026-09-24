import { describe, expect, it, vi } from "vitest";
import { WEEKLY_PRACTICE_LIMITS } from "./weekly-practice-contract";
import { readWeeklyPracticeJsonFile } from "./weekly-practice-file";

describe("Weekly Practice file input", () => {
  it("reads acceptable files without interpreting their content", async () => {
    await expect(readWeeklyPracticeJsonFile({ size: 2, text: async () => "{}" })).resolves.toEqual({ ok: true, text: "{}" });
  });
  it("rejects obvious oversize before reading", async () => {
    const text = vi.fn(async () => "");
    await expect(readWeeklyPracticeJsonFile({ size: WEEKLY_PRACTICE_LIMITS.jsonBytes + 1, text })).resolves.toEqual(expect.objectContaining({ ok: false, reason: "too-large" }));
    expect(text).not.toHaveBeenCalled();
  });
  it("reports browser read failures", async () => {
    await expect(readWeeklyPracticeJsonFile({ size: 1, text: async () => { throw new Error(); } })).resolves.toEqual(expect.objectContaining({ ok: false, reason: "read-failed" }));
  });
});
