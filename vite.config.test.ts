import { describe, expect, it } from "vitest";
import { PRELUDE_PWA_GLOB_PATTERNS } from "./src/pwa-assets";
import {
  PRELUDE_BASE_PATH,
  PRELUDE_PWA_MANIFEST_PATHS,
  PRELUDE_PWA_NAVIGATION_FALLBACK,
  PRELUDE_PWA_REGISTER_TYPE,
} from "./src/pwa-config";

describe("Prelude production and PWA configuration", () => {
  it("keeps the production build on the deployed Prelude subpath", () => {
    expect(PRELUDE_BASE_PATH).toBe("/prelude/");
    expect(PRELUDE_BASE_PATH).not.toBe("/");
  });

  it("keeps the manifest entry points aligned with the Vite base path", () => {
    expect(PRELUDE_PWA_MANIFEST_PATHS).toEqual({
      scope: PRELUDE_BASE_PATH,
      startUrl: PRELUDE_BASE_PATH,
    });
  });

  it("keeps navigation fallback inside the deployed subpath", () => {
    expect(PRELUDE_PWA_NAVIGATION_FALLBACK).toBe(
      `${PRELUDE_BASE_PATH}index.html`,
    );
    expect(PRELUDE_PWA_NAVIGATION_FALLBACK).not.toBe("/index.html");
  });

  it("includes emitted shared piano WAV assets in Workbox precaching", () => {
    expect(PRELUDE_PWA_GLOB_PATTERNS).toContain("**/*.{js,css,html,ico,png,svg,woff2,wav}");
  });

  it("keeps generated service-worker registration in auto-update mode", () => {
    expect(PRELUDE_PWA_REGISTER_TYPE).toBe("autoUpdate");
  });
});
