import { describe, expect, it } from "vitest";
import { PRELUDE_PWA_GLOB_PATTERNS } from "./src/pwa-assets";

describe("Prelude PWA precache configuration", () => {
  it("includes emitted shared piano WAV assets in Workbox precaching", () => {
    expect(PRELUDE_PWA_GLOB_PATTERNS).toContain("**/*.{js,css,html,ico,png,svg,woff2,wav}");
  });
});
