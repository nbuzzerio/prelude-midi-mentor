import { describe, expect, it } from "vitest";
import config from "./vite.config";
import { PRELUDE_PWA_GLOB_PATTERNS } from "./src/pwa-assets";
import {
  PRELUDE_BASE_PATH,
  PRELUDE_PWA_MANIFEST_PATHS,
  PRELUDE_PWA_NAVIGATION_FALLBACK,
  PRELUDE_PWA_REGISTER_TYPE,
} from "./src/pwa-config";

describe("Prelude production and PWA configuration", () => {
  const output = config.build?.rolldownOptions?.output;
  if (!output || Array.isArray(output)) throw new Error("Expected one production output configuration");
  const splitting = output.codeSplitting;
  if (!splitting || typeof splitting === "boolean") throw new Error("Expected named chunk groups");
  const groups = splitting.groups;
  const vendor = groups?.find((group) => group.name === "vexflow");
  if (!vendor || typeof vendor.test !== "function") throw new Error("Expected a VexFlow module filter");
  const matchesVendor = vendor.test;

  it.each([
    "/repo/node_modules/vexflow/build/esm/entry/vexflow.js",
    "/repo/node_modules/.pnpm/vexflow@5.0.0/node_modules/vexflow/build/esm/fonts/bravura.js",
    "C:\\repo\\node_modules\\.pnpm\\vexflow@5.0.0\\node_modules\\vexflow\\build\\esm\\note.js",
  ])("includes VexFlow code and embedded fonts across package paths: %s", (id) => {
    expect(matchesVendor(id)).toBe(true);
  });

  it.each([
    "/repo/node_modules/react/index.js",
    "/repo/node_modules/react-dom/client.js",
    "/repo/node_modules/vexflow-other/index.js",
    "/repo/src/components/music-staff.tsx",
    "/repo/src/features/improv/improv-workspace.tsx",
  ])("keeps other runtimes and feature ownership outside the vendor group: %s", (id) => {
    expect(matchesVendor(id)).toBe(false);
  });

  it("uses only the targeted vendor group without changing eager module preloading", () => {
    expect(groups).toHaveLength(1);
    expect(config.build?.modulePreload).toBeUndefined();
  });

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

  it("keeps generated service-worker registration in prompt mode", () => {
    expect(PRELUDE_PWA_REGISTER_TYPE).toBe("prompt");
  });
});
