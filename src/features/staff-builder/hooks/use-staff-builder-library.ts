import { useCallback, useMemo, useState } from "react";
import { createStaffBuilderScore, renameStaffBuilderScore, type StaffBuilderFactories } from "../staff-builder-score";
import { duplicateStaffBuilderScore, type StaffBuilderDuplicationMode } from "../staff-builder-duplication";
import type { StaffBuilderScore } from "../staff-builder-types";
import type { StaffBuilderTimeSignature } from "../staff-builder-time";
import type { MusicKeyId } from "@/lib/music/keys";
import type { StaffBuilderDraft, StaffBuilderLibrary } from "../persistence/staff-builder-schema";
import { DEFAULT_STAFF_BUILDER_CAPTURE_STATE, type StaffBuilderCaptureState } from "../staff-builder-capture";
import type { StaffBuilderRhythmState } from "../staff-builder-rhythm";
import { validateStaffBuilderScore } from "../staff-builder-validation";
import type { StaffBuilderPersistedEditorState } from "./use-staff-builder-editor";
import { normalizeImportedStaffBuilderPiece, type StaffBuilderImportFactories } from "../persistence/staff-builder-piece-file";
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
  library: StaffBuilderLibrary;
  draft: StaffBuilderDraft | null;
  activeScore: StaffBuilderScore | null;
  activeCaptureState: StaffBuilderCaptureState;
  activeEditorPass: StaffBuilderDraft["editorPass"];
  activeRhythmState: StaffBuilderRhythmState;
  activeSavedPieceId: string | null;
  recoveryDraft: StaffBuilderDraft | null;
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
  const library = libraryResult.ok ? libraryResult.value : { schemaVersion: 3 as const, pieces: [] };
  const draft = draftResult.ok ? draftResult.value : null;
  const savedPiece = draft?.savedPieceId ? library.pieces.find(({ id }) => id === draft.savedPieceId) : undefined;
  const draftMatchesSaved = Boolean(draft && savedPiece && JSON.stringify(draft.score) === JSON.stringify(savedPiece));
  const draftIsNewer = draft && (!savedPiece || (Date.parse(draft.updatedAt) > Date.parse(savedPiece.updatedAt) && !draftMatchesSaved));
  const lastPiece = lastPieceResult.ok && lastPieceResult.value
    ? library.pieces.find(({ id }) => id === lastPieceResult.value) ?? null
    : null;
  const activeSavedPiece = draft?.savedPieceId && savedPiece ? savedPiece : lastPiece;
  return {
    library,
    draft,
    activeScore: draftIsNewer ? null : draftMatchesSaved ? draft?.score ?? activeSavedPiece : activeSavedPiece,
    activeCaptureState: draftMatchesSaved ? draft?.captureState ?? DEFAULT_STAFF_BUILDER_CAPTURE_STATE : DEFAULT_STAFF_BUILDER_CAPTURE_STATE,
    activeEditorPass: draftMatchesSaved ? draft?.editorPass ?? "capture" : "capture",
    activeRhythmState: draftMatchesSaved ? draft?.rhythmState ?? { measureIndex: 0, selectedEventId: null } : { measureIndex: 0, selectedEventId: null },
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
  const [activeEditorPass, setActiveEditorPass] = useState(initial.activeEditorPass);
  const [activeRhythmState, setActiveRhythmState] = useState(initial.activeRhythmState);
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

  const persistDraft = useCallback((score: StaffBuilderScore, savedPieceId: string | null, editorState?: Readonly<{ editorPass: StaffBuilderDraft["editorPass"]; captureState: StaffBuilderCaptureState; rhythmState: StaffBuilderRhythmState }>, updatedAt = score.updatedAt) => {
    if (blockedAreas.has("draft")) return false;
    const draft: StaffBuilderDraft = { schemaVersion: 3, savedPieceId, updatedAt, score, editorPass: editorState?.editorPass ?? "capture", ...(editorState ? { captureState: editorState.captureState, rhythmState: editorState.rhythmState } : {}) };
    return reportWrite("draft", writeStaffBuilderValue(storage, "draft", draft));
  }, [blockedAreas, reportWrite, storage]);

  const persistLibrary = useCallback((next: StaffBuilderLibrary) => {
    if (blockedAreas.has("library")) return false;
    return reportWrite("library", writeStaffBuilderValue(storage, "library", next));
  }, [blockedAreas, reportWrite, storage]);

  const createPiece = useCallback((input: Readonly<{ title: string; keyId: MusicKeyId; timeSignature: StaffBuilderTimeSignature; tempoBpm: number }>) => {
    const score = createStaffBuilderScore({ title: input.title.trim(), tempoBpm: input.tempoBpm, initialKeySignatureId: input.keyId, initialTimeSignature: input.timeSignature });
    const next = { schemaVersion: 3 as const, pieces: [...library.pieces, score] };
    setLibrary(next);
    setActiveScore(score);
    setActiveCaptureState(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
    setActiveEditorPass("capture");
    setActiveRhythmState({ measureIndex: 0, selectedEventId: null });
    setActiveSavedPieceId(score.id);
    persistLibrary(next);
    persistDraft(score, score.id);
    reportWrite("preferences", writeStaffBuilderValue(storage, "lastPieceId", score.id));
  }, [library.pieces, persistDraft, persistLibrary, reportWrite, storage]);

  const importPiece = useCallback((score: StaffBuilderScore, factories?: StaffBuilderImportFactories) => {
    const imported = normalizeImportedStaffBuilderPiece(score, new Set(library.pieces.map(({ id }) => id)), factories);
    const next = { ...library, pieces: [...library.pieces, imported] };
    setLibrary(next);
    return { score: imported, persisted: persistLibrary(next) };
  }, [library, persistLibrary]);

  const duplicatePiece = useCallback((pieceId: string, mode: StaffBuilderDuplicationMode, factories?: StaffBuilderFactories) => {
    const source = library.pieces.find(({ id }) => id === pieceId);
    if (!source) return null;
    const duplicate = duplicateStaffBuilderScore(source, mode, factories);
    const next = { ...library, pieces: [...library.pieces, duplicate] };
    setLibrary(next);
    setActiveScore(duplicate);
    setActiveCaptureState(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
    setActiveEditorPass("capture");
    setActiveRhythmState({ measureIndex: 0, selectedEventId: null });
    setActiveSavedPieceId(duplicate.id);
    const libraryPersisted = persistLibrary(next);
    const draftPersisted = persistDraft(duplicate, duplicate.id);
    reportWrite("preferences", writeStaffBuilderValue(storage, "lastPieceId", duplicate.id));
    return { score: duplicate, persisted: libraryPersisted && draftPersisted };
  }, [library, persistDraft, persistLibrary, reportWrite, storage]);

  const openPiece = useCallback((pieceId: string) => {
    const piece = library.pieces.find(({ id }) => id === pieceId);
    if (!piece) return;
    setActiveScore(piece);
    setActiveCaptureState(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
    setActiveEditorPass("capture");
    setActiveRhythmState({ measureIndex: 0, selectedEventId: null });
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
        || activeCaptureState.stepDuration !== "quarter" || activeCaptureState.inputMode !== "grand";
      const rhythmChanged = activeEditorPass === "rhythm" || activeRhythmState.selectedEventId !== null || activeRhythmState.measureIndex !== 0;
      const draftChanged = activeScore !== piece || captureChanged || rhythmChanged;
      const draftUpdatedAt = draftChanged
        ? new Date(Math.max(Date.now(), Date.parse(renamed.updatedAt) + 1, Date.parse(renamedActive.updatedAt) + 1)).toISOString()
        : renamed.updatedAt;
      persistDraft(renamedActive, pieceId, { editorPass: activeEditorPass, captureState: activeCaptureState, rhythmState: activeRhythmState }, draftUpdatedAt);
    }
    persistLibrary(next);
  }, [activeCaptureState, activeEditorPass, activeRhythmState, activeSavedPieceId, activeScore, library, persistDraft, persistLibrary]);

  const deletePiece = useCallback((pieceId: string) => {
    const next = { ...library, pieces: library.pieces.filter(({ id }) => id !== pieceId) };
    setLibrary(next);
    persistLibrary(next);
    if (activeSavedPieceId === pieceId) {
      setActiveScore(null);
      setActiveCaptureState(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
      setActiveEditorPass("capture");
      setActiveRhythmState({ measureIndex: 0, selectedEventId: null });
      setActiveSavedPieceId(null);
      if (!blockedAreas.has("draft")) reportWrite("draft", removeStaffBuilderValue(storage, "draft"));
      reportWrite("preferences", removeStaffBuilderValue(storage, "lastPieceId"));
    }
  }, [activeSavedPieceId, blockedAreas, library, persistLibrary, reportWrite, storage]);

  const closePiece = useCallback(() => {
    setActiveScore(null);
    setActiveCaptureState(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
    setActiveEditorPass("capture");
    setActiveRhythmState({ measureIndex: 0, selectedEventId: null });
    setActiveSavedPieceId(null);
    if (!blockedAreas.has("draft")) reportWrite("draft", removeStaffBuilderValue(storage, "draft"));
    reportWrite("preferences", removeStaffBuilderValue(storage, "lastPieceId"));
  }, [blockedAreas, reportWrite, storage]);

  const restoreDraft = useCallback(() => {
    if (!recoveryDraft) return;
    setActiveScore(recoveryDraft.score);
    setActiveCaptureState(recoveryDraft.captureState ?? DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
    setActiveEditorPass(recoveryDraft.editorPass);
    setActiveRhythmState(recoveryDraft.rhythmState ?? { measureIndex: 0, selectedEventId: null });
    setActiveSavedPieceId(recoveryDraft.savedPieceId);
    setRecoveryDraft(null);
  }, [recoveryDraft]);

  const declineDraft = useCallback(() => {
    const saved = recoveryDraft?.savedPieceId ? library.pieces.find(({ id }) => id === recoveryDraft.savedPieceId) ?? null : null;
    setActiveScore(saved);
    setActiveCaptureState(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
    setActiveEditorPass("capture");
    setActiveRhythmState({ measureIndex: 0, selectedEventId: null });
    setActiveSavedPieceId(saved?.id ?? null);
    setRecoveryDraft(null);
    if (!blockedAreas.has("draft")) reportWrite("draft", removeStaffBuilderValue(storage, "draft"));
  }, [blockedAreas, library.pieces, recoveryDraft, reportWrite, storage]);

  const closeIntroduction = useCallback((dismiss: boolean) => {
    setIntroductionOpen(false);
    if (dismiss) reportWrite("preferences", writeStaffBuilderValue(storage, "introductionDismissed", "true"));
  }, [reportWrite, storage]);

  const updateActiveDraft = useCallback((score: StaffBuilderScore, editorState: Readonly<{ editorPass: StaffBuilderDraft["editorPass"]; captureState: StaffBuilderCaptureState; rhythmState: StaffBuilderRhythmState }>) => {
    setActiveScore(score);
    setActiveCaptureState(editorState.captureState);
    setActiveEditorPass(editorState.editorPass);
    setActiveRhythmState(editorState.rhythmState);
    if (activeSavedPieceId !== null) {
      const saved = library.pieces.find(({ id }) => id === activeSavedPieceId);
      if (saved && JSON.stringify(saved) !== JSON.stringify(score)) {
        const nextLibrary = { ...library, pieces: library.pieces.map((piece) => piece.id === activeSavedPieceId ? score : piece) };
        setLibrary(nextLibrary);
        persistLibrary(nextLibrary);
      }
    }
    if (blockedAreas.has("draft")) return false;
    const draft: StaffBuilderDraft = {
      schemaVersion: 3,
      savedPieceId: activeSavedPieceId,
      updatedAt: new Date(Math.max(Date.now(), Date.parse(score.updatedAt) + 1)).toISOString(),
      score,
      editorPass: editorState.editorPass,
      captureState: editorState.captureState,
      rhythmState: editorState.rhythmState,
    };
    return reportWrite("draft", writeStaffBuilderValue(storage, "draft", draft));
  }, [activeSavedPieceId, blockedAreas, library, persistLibrary, reportWrite, storage]);

  const validateAndSave = useCallback((score: StaffBuilderScore, editorState: StaffBuilderPersistedEditorState) => {
    const validationIssues = validateStaffBuilderScore(score);
    if (validationIssues.length > 0) return { ok: false as const, reason: "invalid" as const, issues: validationIssues };
    const pieceId = activeSavedPieceId ?? score.id;
    const savedScore = score.id === pieceId ? score : { ...score, id: pieceId };
    const nextLibrary = { ...library, pieces: library.pieces.some(({ id }) => id === pieceId)
      ? library.pieces.map((piece) => piece.id === pieceId ? savedScore : piece)
      : [...library.pieces, savedScore] };
    if (!persistLibrary(nextLibrary)) return { ok: false as const, reason: "storage" as const, issues: [] };
    setLibrary(nextLibrary);
    setActiveScore(savedScore);
    setActiveSavedPieceId(pieceId);
    const draft: StaffBuilderDraft = { schemaVersion: 3, savedPieceId: pieceId, updatedAt: savedScore.updatedAt, score: savedScore, editorPass: editorState.editorPass, captureState: editorState.captureState, rhythmState: editorState.rhythmState };
    const draftSaved = blockedAreas.has("draft") ? false : reportWrite("draft", writeStaffBuilderValue(storage, "draft", draft));
    return { ok: true as const, score: savedScore, draftSynchronized: draftSaved };
  }, [activeSavedPieceId, blockedAreas, library, persistLibrary, reportWrite, storage]);

  const clearCorruptArea = useCallback((area: "library" | "draft") => {
    const result = removeStaffBuilderValue(storage, area);
    if (!result.ok) { reportWrite(area, result); return; }
    setBlockedAreas((current) => { const next = new Set(current); next.delete(area); return next; });
    setIssues((current) => current.filter((issue) => issue.area !== area));
  }, [reportWrite, storage]);

  return {
    library, activeScore, activeCaptureState, activeEditorPass, activeRhythmState, activeSavedPieceId, recoveryDraft, introductionOpen, issues,
    createPiece, importPiece, duplicatePiece, openPiece, renamePiece, deletePiece, closePiece, restoreDraft, declineDraft,
    closeIntroduction, reopenIntroduction: () => setIntroductionOpen(true), clearCorruptArea, updateActiveDraft, validateAndSave,
  };
}
