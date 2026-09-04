export const PRELUDE_BASE_PATH = "/prelude/";

export const PRELUDE_PWA_MANIFEST_PATHS = {
  scope: PRELUDE_BASE_PATH,
  startUrl: PRELUDE_BASE_PATH,
} as const;

export const PRELUDE_PWA_NAVIGATION_FALLBACK = `${PRELUDE_BASE_PATH}index.html`;

export const PRELUDE_PWA_REGISTER_TYPE = "autoUpdate" as const;
