import {
  parseStaffBuilderDraft,
  parseStaffBuilderLibrary,
  type StaffBuilderDraft,
  type StaffBuilderLibrary,
  type StaffBuilderParseResult,
} from "./staff-builder-schema";

export const STAFF_BUILDER_STORAGE_KEYS = {
  library: "prelude-staff-builder-library-v1",
  draft: "prelude-staff-builder-draft-v1",
  lastPieceId: "prelude-staff-builder-last-piece-id",
  introductionDismissed: "prelude-staff-builder-introduction-dismissed",
} as const;

export type StaffBuilderStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type StaffBuilderStorageResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; reason: "unavailable" | "corrupt" | "unsupported" | "write-failed"; message: string }>;

function unavailable(message: string): StaffBuilderStorageResult<never> {
  return { ok: false, reason: "unavailable", message };
}

function readParsed<T>(storage: StaffBuilderStorage, key: string, empty: T, parser: (value: unknown) => StaffBuilderParseResult<T>): StaffBuilderStorageResult<T> {
  let raw: string | null;
  try { raw = storage.getItem(key); } catch { return unavailable("Staff Builder storage is unavailable in this browser."); }
  if (raw === null) return { ok: true, value: empty };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { ok: false, reason: "corrupt", message: "Stored Staff Builder data could not be read." }; }
  return parser(value);
}

export function readStaffBuilderLibrary(storage: StaffBuilderStorage): StaffBuilderStorageResult<StaffBuilderLibrary> {
  return readParsed(storage, STAFF_BUILDER_STORAGE_KEYS.library, { schemaVersion: 2, pieces: [] }, parseStaffBuilderLibrary);
}

export function readStaffBuilderDraft(storage: StaffBuilderStorage): StaffBuilderStorageResult<StaffBuilderDraft | null> {
  return readParsed(storage, STAFF_BUILDER_STORAGE_KEYS.draft, null, (value) => parseStaffBuilderDraft(value));
}

export function readStaffBuilderString(storage: StaffBuilderStorage, key: "lastPieceId"): StaffBuilderStorageResult<string | null> {
  try { return { ok: true, value: storage.getItem(STAFF_BUILDER_STORAGE_KEYS[key]) }; }
  catch { return unavailable("Staff Builder preferences could not be read."); }
}

export function readStaffBuilderIntroductionDismissed(storage: StaffBuilderStorage): StaffBuilderStorageResult<boolean> {
  try {
    const value = storage.getItem(STAFF_BUILDER_STORAGE_KEYS.introductionDismissed);
    return value === null || value === "true" || value === "false"
      ? { ok: true, value: value === "true" }
      : { ok: false, reason: "corrupt", message: "The Staff Builder introduction preference is invalid." };
  } catch { return unavailable("Staff Builder preferences could not be read."); }
}

export function writeStaffBuilderValue(storage: StaffBuilderStorage, key: keyof typeof STAFF_BUILDER_STORAGE_KEYS, value: unknown): StaffBuilderStorageResult<null> {
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    storage.setItem(STAFF_BUILDER_STORAGE_KEYS[key], serialized);
    return { ok: true, value: null };
  } catch {
    return { ok: false, reason: "write-failed", message: "Staff Builder changes could not be saved in this browser." };
  }
}

export function removeStaffBuilderValue(storage: StaffBuilderStorage, key: keyof typeof STAFF_BUILDER_STORAGE_KEYS): StaffBuilderStorageResult<null> {
  try { storage.removeItem(STAFF_BUILDER_STORAGE_KEYS[key]); return { ok: true, value: null }; }
  catch { return { ok: false, reason: "write-failed", message: "Stored Staff Builder data could not be cleared." }; }
}
