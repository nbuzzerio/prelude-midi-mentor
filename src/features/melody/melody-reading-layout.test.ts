import { describe, expect, it } from "vitest";
import { getMelodyReadingLayout, getMelodyReadingScrollLeft } from "./melody-reading-layout";

describe("Melody reading layout", () => {
  it("keeps both laptop rows at the same readable scale with either keyboard choice", () => {
    expect(getMelodyReadingLayout(1185, true, false)).toEqual({ scale: 1.8, width: 658 });
    expect(getMelodyReadingLayout(1185, true, true)).toEqual(getMelodyReadingLayout(1185, true, false));
    expect(getMelodyReadingLayout(1185, false, true).scale).toBe(2.2);
  });
  it("uses bounded phone notation sizes instead of shrinking an entire wide score", () => {
    expect(getMelodyReadingLayout(275, true, true)).toEqual({ scale: 1.4, width: 196 });
    expect(getMelodyReadingLayout(400, true, true).scale).toBe(1.6);
    expect(getMelodyReadingLayout(0, true, false)).toEqual(getMelodyReadingLayout(Number.NaN, true, false));
  });
  it("never pans the opening note on its first onset and follows within the available content", () => {
    expect(getMelodyReadingScrollLeft(170, 170, 275, 600)).toBe(0);
    expect(getMelodyReadingScrollLeft(300, 170, 275, 600)).toBe(130);
    expect(getMelodyReadingScrollLeft(900, 170, 275, 600)).toBe(325);
    expect(getMelodyReadingScrollLeft(200, 100, 1000, 900)).toBe(0);
  });
});
