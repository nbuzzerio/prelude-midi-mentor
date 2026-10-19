import { expect, it } from "vitest";
import { describeBuild } from "./build-identity";
const revision = "abcdef1234567890abcdef1234567890abcdef12";
it("shows the running full revision in details and short revision in the label", () => {
  expect(describeBuild({ revision, dirty: false, development: false })).toEqual({ label: "build abcdef12", detail: `Running bundle revision: ${revision}.` });
});
it("distinguishes local changes and unknown worktree state", () => {
  expect(describeBuild({ revision, dirty: true, development: false }).label).toBe("build abcdef12 · local changes");
  expect(describeBuild({ revision, dirty: null, development: false }).label).toContain("worktree unverified");
});
it("uses explicit unavailable/local-development fallbacks without fabricated IDs", () => {
  expect(describeBuild({ revision: null, dirty: null, development: false }).label).toBe("build revision unavailable");
  expect(describeBuild({ revision: "fiction", dirty: false, development: true }).label).toBe("local development");
});
