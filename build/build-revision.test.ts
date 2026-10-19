// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveBuildRevision } from "./build-revision";
const sha = "abcdef1234567890abcdef1234567890abcdef12";
describe("compiled revision from checked-out source", () => {
  it("accepts a matching clean CI checkout", () => {
    expect(resolveBuildRevision(sha, args => args[0] === "rev-parse" ? sha : "")).toEqual({ revision: sha, dirty: false });
    expect(readFileSync(".github/workflows/deploy.yml", "utf8")).toContain("PRELUDE_BUILD_REVISION: ${{ github.sha }}");
  });
  it("rejects a forged or mismatched environment revision", () => {
    expect(() => resolveBuildRevision("made-up", () => sha)).toThrow("full Git revision");
    expect(() => resolveBuildRevision("1".repeat(40), () => sha)).toThrow("does not match");
  });
  it("rejects dirty or unverifiable CI source", () => {
    expect(() => resolveBuildRevision(sha, args => args[0] === "rev-parse" ? sha : " M src/App.tsx")).toThrow("clean checkout");
    expect(() => resolveBuildRevision(sha, () => { throw Error("unavailable"); })).toThrow("Cannot verify");
    expect(() => resolveBuildRevision(sha, args => { if (args[0] === "rev-parse") return sha; throw Error("unavailable"); })).toThrow("clean checkout");
  });
  it("marks local edits and supports an archive without Git or network", () => {
    expect(resolveBuildRevision(undefined, args => args[0] === "rev-parse" ? sha : "?? new-source.ts")).toEqual({ revision: sha, dirty: true });
    expect(resolveBuildRevision(undefined, () => { throw Error("no Git"); })).toEqual({ revision: null, dirty: null });
  });
});
