import { useCallback, useMemo, useState } from "react";
import { createStaffBuilderScore, renameStaffBuilderScore } from "../staff-builder-score";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import type { StaffBuilderTimeSignature } from "../staff-builder-time";
import type { MusicKeyId } from "@/lib/music/keys";
import type { StaffBuilderDraftV1, StaffBuilderLibraryV1 } from "../persistence/staff-builder-schema";
import { DEFAULT_STAFF_BUILDER_CAPTURE_STATE, type StaffBuilderCaptureState } from "../staff-builder-capture";
import {
  readStaffBuilderDraft,
  readStaffBuilderIntroductionDismissed,
  readStaffBuilderLibrary,
  readStaffBuilderString,
  removeStaffBuilderValue,
  writeStaffBuilderValue,
  type StaffBuilderStorage,
} from "../persistence/staff-builder-storage";

export type StaffBuilderStorageIssue = Readonly<{
  area: "library" | "draft" | "preferences";
  message: string;
  clearable: boolean;
}>;

type InitialState = Readonly<{
  library: StaffBuilderLibraryV1;
  draft: StaffBuilderDraftV1 | null;
  activeScore: StaffBuilderScoreV1 | null;
  activeCaptureState: StaffBuilderCaptureState;
  activeSavedPieceId: string | null;
  recoveryDraft: StaffBuilderDraftV1 | null;
  introductionOpen: boolean;
  issues: readonly StaffBuilderStorageIssue[];
  blockedAreas: ReadonlySet<"library" | "draft">;
}>;

function loadInitialState(storage: StaffBuilderStorage): InitialState {
  const libraryResult = readStaffBuilderLibrary(storage);
  const draftResult = readStaffBuilderDraft(storage);
  const introResult = readStaffBuilderIntroductionDismissed(storage);
  const lastPieceResult = readStaffBuilderString(storage, "lastPieceId");
  const issues: StaffBuilderStorageIssue[] = [];
  const blockedAreas = new Set<"library" | "draft">();
  if (!libraryResult.ok) {
    issues.push({ area: "library", message: libraryResult.message, clearable: libraryResult.reason === "corrupt" || libraryResult.reason === "unsupported" });
    blockedAreas.add("library");
  }
  if (!draftResult.ok) {
    issues.push({ area: "draft", message: draftResult.message, clearable: draftResult.reason === "corrupt" || draftResult.reason === "unsupported" });
    blockedAreas.add("draft");
  }
  if (!introResult.ok) issues.push({ area: "preferences", message: introResult.message, clearable: false });
  if (!lastPieceResult.ok) issues.push({ area: "preferences", message: lastPieceResult.message, clearable: false });
  const library = libraryResult.ok ? libraryResult.value : { schemaVersion: 1 as const, pieces: [] };
  const draft = draftResult.ok ? draftResult.value : null;
  const savedPiece = draft?.savedPieceId ? library.pieces.find(({ id }) => id === draft.savedPieceId) : undefined;
  const draftIsNewer = draft && (!savedPiece || Date.parse(draft.updatedAt) > Date.parse(savedPiece.updatedAt));
  const lastPiece = lastPieceResult.ok && lastPieceResult.value
    ? library.pieces.find(({ id }) => id === lastPieceResult.value) ?? null
    : null;
  const activeSavedPiece = draft?.savedPieceId && savedPiece ? savedPiece : lastPiece;
  return {
    library,
    draft,
    activeScore: draftIsNewer ? null : activeSavedPiece,
    activeCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE,
    activeSavedPieceId: draftIsNewer ? null : activeSavedPiece?.id ?? null,
    recoveryDraft: draftIsNewer ? draft : null,
    introductionOpen: !(introResult.ok && introResult.value),
    issues,
    blockedAreas,
  };
}

export function useStaffBuilderLibrary(storage: StaffBuilderStorage) {
  const initial = useMemo(() => loadInitialState(storage), [storage]);
  const [library, setLibrary] = useState(initial.library);
  const [activeScore, setActiveScore] = useState(initial.activeScore);
  const [activeCaptureState, setActiveCaptureState] = useState(initial.activeCaptureState);
  const [activeSavedPieceId, setActiveSavedPieceId] = useState<string | null>(initial.activeSavedPieceId);
  const [recoveryDraft, setRecoveryDraft] = useState(initial.recoveryDraft);
  const [introductionOpen, setIntroductionOpen] = useState(initial.introductionOpen);
  const [issues, setIssues] = useState<readonly StaffBuilderStorageIssue[]>(initial.issues);
  const [blockedAreas, setBlockedAreas] = useState(initial.blockedAreas);

  const reportWrite = useCallback((area: StaffBuilderStorageIssue["area"], result: ReturnType<typeof writeStaffBuilderValue>) => {
    setIssues((current) => result.ok
      ? current.filter((issue) => issue.area !== area || issue.clearable)
      : [...current.filter((issue) => issue.area !== area), { area, message: result.message, clearable: false }]);
    return result.ok;
  }, []);

  const persistDraft = useCallback((score: StaffBuilderScoreV1, savedPieceId: string | null, captureState?: StaffBuilderCaptureState, updatedAt = score.updatedAt) => {
    if (blockedAreas.has("draft")) return false;
    const draft: StaffBuilderDraftV1 = { schemaVersion: 1, savedPieceId, updatedAt, score, editorPass: "capture", ...(captureState ? { captureState } : {}) };
    return reportWrite("draft", writeStaffBuilderValue(storage, "draft", draft));
  }, [blockedAreas, reportWrite, storage]);

  const persistLibrary = useCallback((next: StaffBuilderLibraryV1) => {
    if (blockedAreas.has("library")) return false;
    return reportWrite("library", writeStaffBuilderValue(storage, "library", next));
  }, [blockedAreas, reportWrite, storage]);

  const createPiece = useCallback((input: Readonly<{ title: string; keyId: MusicKeyId; timeSignature: StaffBuilderTimeSignature; tempoBpm: number }>) => {
    const score = createStaffBuilderScore({ title: input.title.trim(), tempoBpm: input.tempoBpm, initialKeySignatureId: input.keyId, initialTimeSignature: input.timeSignature });
    const next = { schemaVersion: 1 as const, pieces: [...library.pieces, score] };
    setLibrary(next);
    setActiveScore(score);
    setActiveCaptureState(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
    setActiveSavedPieceId(score.id);
    persistLibrary(next);
    persistDraft(score, score.id);
    reportWrite("preferences", writeStaffBuilderValue(storage, "lastPieceId", score.id));
  }, [library.pieces, persistDraft, persistLibrary, reportWrite, storage]);

  const openPiece = useCallback((pieceId: string) => {
    const piece = library.pieces.find(({ id }) => id === pieceId);
    if (!piece) return;
    setActiveScore(piece);
    setActiveCaptureState(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
    setActiveSavedPieceId(piece.id);
    persistDraft(piece, piece.id);
    reportWrite("preferences", writeStaffBuilderValue(storage, "lastPieceId", piece.id));
  }, [library.pieces, persistDraft, reportWrite, storage]);

  const renamePiece = useCallback((pieceId: string, title: string) => {
    const piece = library.pieces.find(({ id }) => id === pieceId);
    if (!piece || !title.trim()) return;
    const renamed = renameStaffBuilderScore(piece, title.trim());
    const next = { ...library, pieces: library.pieces.map((item) => item.id === pieceId ? renamed : item) };
    setLibrary(next);
    if (activeSavedPieceId === pieceId) {
      const renamedActive = renameStaffBuilderScore(activeScore ?? renamed, title.trim());
      setActiveScore(renamedActive);
      const captureChanged = activeCaptureState.cursor.measureIndex !== 0 || activeCaptureState.cursor.offsetTicks !== 0
        || activeCaptureState.stepDuration !== "quarter" || activeCaptureState.activeStaff !== "treble";
      const draftChanged = activeScore !== piece || captureChanged;
      const draftUpdatedAt = draftChanged
        ? new Date(Math.max(Date.now(), Date.parse(renamed.updatedAt) + 1, Date.parse(renamedActive.updatedAt) + 1)).toISOString()
        : renamed.updatedAt;
      persistDraft(renamedActive, pieceId, activeCaptureState, draftUpdatedAt);
    }
    persistLibrary(next);
  }, [activeCaptureState, activeSavedPieceId, activeScore, library, persistDraft, persistLibrary]);

  const deletePiece = useCallback((pieceId: string) => {
    const next = { ...library, pieces: library.pieces.filter(({ id }) => id !== pieceId) };
    setLibrary(next);
    persistLibrary(next);
    if (activeSavedPieceId === pieceId) {
      setActiveScore(null);
      setActiveCaptureState(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
      setActiveSavedPieceId(null);
      if (!blockedAreas.has("draft")) reportWrite("draft", removeStaffBuilderValue(storage, "draft"));
      reportWrite("preferences", removeStaffBuilderValue(storage, "lastPieceId"));
    }
  }, [activeSavedPieceId, blockedAreas, library, persistLibrary, reportWrite, storage]);

  const closePiece = useCallback(() => {
    setActiveScore(null);
    setActiveCaptureState(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
    setActiveSavedPieceId(null);
    if (!blockedAreas.has("draft")) reportWrite("draft", removeStaffBuilderValue(storage, "draft"));
    reportWrite("preferences", removeStaffBuilderValue(storage, "lastPieceId"));
  }, [blockedAreas, reportWrite, storage]);

  const restoreDraft = useCallback(() => {
    if (!recoveryDraft) return;
    setActiveScore(recoveryDraft.score);
    setActiveCaptureState(recoveryDraft.captureState ?? DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
    setActiveSavedPieceId(recoveryDraft.savedPieceId);
    setRecoveryDraft(null);
  }, [recoveryDraft]);

  const declineDraft = useCallback(() => {
    const saved = recoveryDraft?.savedPieceId ? library.pieces.find(({ id }) => id === recoveryDraft.savedPieceId) ?? null : null;
    setActiveScore(saved);
    setActiveCaptureState(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
    setActiveSavedPieceId(saved?.id ?? null);
    setRecoveryDraft(null);
    if (!blockedAreas.has("draft")) reportWrite("draft", removeStaffBuilderValue(storage, "draft"));
  }, [blockedAreas, library.pieces, recoveryDraft, reportWrite, storage]);

  const closeIntroduction = useCallback((dismiss: boolean) => {
    setIntroductionOpen(false);
    if (dismiss) reportWrite("preferences", writeStaffBuilderValue(storage, "introductionDismissed", "true"));
  }, [reportWrite, storage]);

  const updateActiveDraft = useCallback((score: StaffBuilderScoreV1, captureState: StaffBuilderCaptureState) => {
    setActiveScore(score);
    setActiveCaptureState(captureState);
    if (blockedAreas.has("draft")) return false;
    const draft: StaffBuilderDraftV1 = {
      schemaVersion: 1,
      savedPieceId: activeSavedPieceId,
      updatedAt: new Date(Math.max(Date.now(), Date.parse(score.updatedAt) + 1)).toISOString(),
      score,
      editorPass: "capture",
      captureState,
    };
    return reportWrite("draft", writeStaffBuilderValue(storage, "draft", draft));
  }, [activeSavedPieceId, blockedAreas, reportWrite, storage]);

  const clearCorruptArea = useCallback((area: "library" | "draft") => {
    const result = removeStaffBuilderValue(storage, area);
    if (!result.ok) { reportWrite(area, result); return; }
    setBlockedAreas((current) => { const next = new Set(current); next.delete(area); return next; });
    setIssues((current) => current.filter((issue) => issue.area !== area));
  }, [reportWrite, storage]);

  return {
    library, activeScore, activeCaptureState, activeSavedPieceId, recoveryDraft, introductionOpen, issues,
    createPiece, openPiece, renamePiece, deletePiece, closePiece, restoreDraft, declineDraft,
    closeIntroduction, reopenIntroduction: () => setIntroductionOpen(true), clearCorruptArea, updateActiveDraft,
  };
}
