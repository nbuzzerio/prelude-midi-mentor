import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import {
  getStaffBuilderPieceFilename,
  parseStaffBuilderPieceFileText,
  serializeStaffBuilderPiece,
  type StaffBuilderPieceFileParseResult,
} from "./staff-builder-piece-file";

export type StaffBuilderPieceFileReadResult = StaffBuilderPieceFileParseResult
  | Readonly<{ ok: false; reason: "read-failed"; message: string }>;

export async function readStaffBuilderPieceFile(file: Pick<File, "text">): Promise<StaffBuilderPieceFileReadResult> {
  try {
    return parseStaffBuilderPieceFileText(await file.text());
  } catch {
    return { ok: false, reason: "read-failed", message: "Prelude could not read that piece file. Try selecting it again." };
  }
}

export function downloadStaffBuilderPiece(score: StaffBuilderScoreV1): void {
  const blob = new Blob([serializeStaffBuilderPiece(score)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.download = getStaffBuilderPieceFilename(score);
  anchor.href = url;
  anchor.hidden = true;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
