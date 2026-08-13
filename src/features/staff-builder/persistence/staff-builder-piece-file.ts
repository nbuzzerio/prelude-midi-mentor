import type { StaffBuilderScore } from "../staff-builder-types";
import { parseStaffBuilderScore } from "./staff-builder-schema";

export const STAFF_BUILDER_PIECE_FILE_EXTENSION = ".prelude.json";

export type StaffBuilderPieceFileParseResult =
  | Readonly<{ ok: true; score: StaffBuilderScore }>
  | Readonly<{
      ok: false;
      reason: "invalid-json" | "invalid-score" | "unsupported-version";
      message: string;
    }>;

export type StaffBuilderImportFactories = Readonly<{
  createId: () => string;
  now: () => string;
}>;

const defaultImportFactories: StaffBuilderImportFactories = {
  createId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

export function serializeStaffBuilderPiece(score: StaffBuilderScore): string {
  const parsed = parseStaffBuilderScore(score);
  if (!parsed.ok) throw new Error("Cannot export an invalid Staff Builder score object.");
  return `${JSON.stringify(parsed.value, null, 2)}\n`;
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function getStaffBuilderPieceFilename(score: Pick<StaffBuilderScore, "id" | "title">): string {
  const titleSlug = slug(score.title);
  const fallbackId = slug(score.id).slice(0, 12) || "backup";
  return `${titleSlug || `staff-builder-piece-${fallbackId}`}${STAFF_BUILDER_PIECE_FILE_EXTENSION}`;
}

export function parseStaffBuilderPieceFileText(text: string): StaffBuilderPieceFileParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid-json", message: "This file is not valid Prelude piece JSON." };
  }
  const parsed = parseStaffBuilderScore(value);
  if (parsed.ok) return { ok: true, score: parsed.value };
  return parsed.reason === "unsupported"
    ? { ok: false, reason: "unsupported-version", message: "This piece was created by an unsupported version of Prelude." }
    : { ok: false, reason: "invalid-score", message: "This file does not contain a valid Staff Builder piece." };
}

export function normalizeImportedStaffBuilderPiece(
  score: StaffBuilderScore,
  existingScoreIds: ReadonlySet<string>,
  factories: StaffBuilderImportFactories = defaultImportFactories,
): StaffBuilderScore {
  if (!existingScoreIds.has(score.id)) return score;
  let id = factories.createId();
  while (existingScoreIds.has(id)) id = factories.createId();
  return { ...score, id, updatedAt: factories.now() };
}
