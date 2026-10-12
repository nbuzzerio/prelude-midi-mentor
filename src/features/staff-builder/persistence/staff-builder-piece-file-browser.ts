import type { StaffBuilderScore } from "../staff-builder-types";
import { requestBrowserDownload, type DownloadSnapshot } from "@/lib/files/browser-download";
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

export function downloadStaffBuilderPiece(score: StaffBuilderScore): void {
  requestBrowserDownload(createStaffBuilderPieceDownload(score).blob, getStaffBuilderPieceFilename(score));
}

export function createStaffBuilderPieceDownload(score: StaffBuilderScore): DownloadSnapshot {
  return Object.freeze({ blob: new Blob([serializeStaffBuilderPiece(score)], { type: "application/json" }),
    name: score.title, fallback: "staff_builder_piece", extension: "prelude.json", format: "Staff Builder score JSON" });
}
