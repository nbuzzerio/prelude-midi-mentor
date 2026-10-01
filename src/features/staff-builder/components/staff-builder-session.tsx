import { useEffect, useRef, useState } from "react";
import { PiecePracticeSession } from "@/features/piece-practice/components/piece-practice-session";
import { projectStaffBuilderPieceForPractice } from "@/features/piece-practice/piece-practice-projection";
import type { PiecePracticePiece } from "@/features/piece-practice/piece-practice-types";
import { piecePracticeAssessmentLabel } from "@/features/piece-practice/piece-practice-assessment";
import { parsePiecePracticeRun, piecePracticeRunStore, selectPiecePracticeRecovery, type PiecePracticeRunRecordV1 } from "@/features/piece-practice/persistence/piece-practice-runs";
import { StaffBuilderIntroduction } from "./staff-builder-introduction";
import { StaffBuilderLibrary } from "./staff-builder-library";
import { StaffBuilderPieceSetup } from "./staff-builder-piece-setup";
import { StaffBuilderWorkspacePlaceholder } from "./staff-builder-workspace-placeholder";
import { StaffBuilderPrintFlow } from "./staff-builder-print-flow";
import { useStaffBuilderLibrary } from "../hooks/use-staff-builder-library";
import type { StaffBuilderScore } from "../staff-builder-types";
import { readStaffBuilderSustainPedalLocksInput, writeStaffBuilderValue, type StaffBuilderStorage } from "../persistence/staff-builder-storage";
import { downloadStaffBuilderPiece, readStaffBuilderPieceFile } from "../persistence/staff-builder-piece-file-browser";

const unavailableStorage: StaffBuilderStorage = {
  getItem: () => { throw new Error("unavailable"); },
  setItem: () => { throw new Error("unavailable"); },
  removeItem: () => { throw new Error("unavailable"); },
};

function browserStorage(): StaffBuilderStorage {
  try { return window.localStorage; } catch { return unavailableStorage; }
}

export default function StaffBuilderSession({ storage = browserStorage() }: Readonly<{ storage?: StaffBuilderStorage }>) {
  const [initialPedalPreference] = useState(() => readStaffBuilderSustainPedalLocksInput(storage));
  const [sustainPedalLocksInput, setSustainPedalLocksInput] = useState(initialPedalPreference.ok ? initialPedalPreference.value : false);
  const [preferenceError, setPreferenceError] = useState(initialPedalPreference.ok ? null : initialPedalPreference.message);
  const state = useStaffBuilderLibrary(storage);
  const [practicePiece, setPracticePiece] = useState<PiecePracticePiece | null>(null);
  const [practiceSourceScore, setPracticeSourceScore] = useState<StaffBuilderScore | null>(null);
  const [openedRun, setOpenedRun] = useState<PiecePracticeRunRecordV1 | null>(null);
  const [availableRuns, setAvailableRuns] = useState<unknown[]>([]);
  const [runStorageError, setRunStorageError] = useState(false);
  const [practiceLaunchError, setPracticeLaunchError] = useState<string | null>(null);
  const [pieceFileStatus, setPieceFileStatus] = useState<Readonly<{ kind: "error" | "success"; message: string }> | null>(null);
  const [printPiece, setPrintPiece] = useState<StaffBuilderScore | null>(null);
  const introductionOpenerRef = useRef<HTMLButtonElement>(null);
  const refreshRuns = () => { void piecePracticeRunStore.list().then((runs) => { setAvailableRuns(runs); setRunStorageError(false); }).catch(() => setRunStorageError(true)); };
  useEffect(() => { refreshRuns(); }, []);
  const { active: activeRuns, latestCompleted } = selectPiecePracticeRecovery(availableRuns);
  const latestActive = activeRuns[0];
  const openStoredRun = (value: unknown) => {
    const parsed = parsePiecePracticeRun(value);
    if (!parsed.ok) return;
    setPracticeSourceScore(parsed.record.sourceScore);
    setOpenedRun(parsed.record);
    setPracticePiece(parsed.piece);
  };
  const discardStoredRun = (value: unknown) => {
    if (typeof value !== "object" || value === null || !("runId" in value) || typeof value.runId !== "string") return;
    if (!window.confirm(`Discard saved Piece Practice run ${value.runId}? This permanently removes its practice evidence.`)) return;
    void piecePracticeRunStore.discard(value.runId).then(refreshRuns).catch(() => setRunStorageError(true));
  };
  if (practicePiece) {
    return <PiecePracticeSession key={openedRun?.runId ?? practiceSourceScore?.id ?? practicePiece.sourceScoreId} onExit={() => { setPracticePiece(null); setOpenedRun(null); refreshRuns(); }} piece={practicePiece} recoveredRun={openedRun ?? undefined} sourceScore={practiceSourceScore ?? undefined} />;
  }
  const launchPiecePractice = (score: Parameters<typeof projectStaffBuilderPieceForPractice>[0]) => {
    const projection = projectStaffBuilderPieceForPractice(score);
    if (!projection.ok) {
      setPracticeLaunchError("This piece could not be opened for practice because it is not structurally valid.");
      return;
    }
    setPracticeLaunchError(null);
    state.recordPiecePractice(score.id);
    setPracticeSourceScore(score);
    setOpenedRun(null);
    setPracticePiece(projection.piece);
  };
  return (
    <div className="staff-builder-shell">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Staff Builder</h1><p className="text-zinc-300">Build a simplified, local practice reference.</p></div>
        <button className="staff-builder-secondary-button" onClick={state.reopenIntroduction} ref={introductionOpenerRef} type="button">About Staff Builder</button>
      </header>

      <aside className="staff-builder-storage-notice">
        <strong>Pieces are stored only in this browser and device.</strong> Clearing browser data may delete pieces. Pieces are not synced; download Prelude piece files to keep backups you can import later.
      </aside>

      {runStorageError && <p role="status">Saved Piece Practice runs are unavailable in this browser. Fresh practice can continue in memory.</p>}
      {latestActive ? <section aria-label="Recovered practice session" className="staff-builder-recovery">
        {(() => { const parsed = parsePiecePracticeRun(latestActive); return parsed.ok ? <>
          <strong>Recovered practice session</strong><p>{parsed.record.sourceScore.title} · {piecePracticeAssessmentLabel(parsed.record.configuration.assessmentFocus)} · Measures {parsed.record.configuration.startMeasureIndex + 1}–{(parsed.record.configuration.endMeasureIndex ?? parsed.piece.measures.length - 1) + 1}</p>
          <p>Last saved {new Date(parsed.record.updatedAt).toLocaleString()}</p>
          <p>Starting fresh will end other active runs after the new run is saved; their evidence remains stored.</p>
          <button className="staff-builder-secondary-button" onClick={() => openStoredRun(latestActive)} type="button">Resume Practice</button>
        </> : <p>This saved practice session cannot be recovered with this version ({parsed.reason}).</p>; })()}
        <button className="staff-builder-danger-button" onClick={() => discardStoredRun(latestActive)} type="button">Discard</button>
        {activeRuns.length > 1 && <details><summary>{activeRuns.length - 1} other active saved runs</summary><ul>{activeRuns.slice(1).map((value, index) => {
          const parsed = parsePiecePracticeRun(value);
          const runId = typeof value === "object" && value !== null && "runId" in value ? String(value.runId) : String(index);
          return <li key={runId}>{parsed.ok ? <><span>{parsed.record.sourceScore.title} · {new Date(parsed.record.updatedAt).toLocaleString()}</span><button className="staff-builder-secondary-button" onClick={() => openStoredRun(value)} type="button">Resume Practice</button></> : <span>Run {runId} cannot be recovered ({parsed.reason}).</span>}<button className="staff-builder-danger-button" onClick={() => discardStoredRun(value)} type="button">Discard</button></li>;
        })}</ul></details>}
      </section> : null}
      {latestCompleted ? <section aria-label="Last completed practice" className="staff-builder-recovery">
        {(() => { const parsed = parsePiecePracticeRun(latestCompleted); return parsed.ok ? <>
          <strong>Last completed practice</strong><p>{parsed.record.sourceScore.title} · Completed {new Date(parsed.record.completedAt!).toLocaleString()} · Assessment: {piecePracticeAssessmentLabel(parsed.record.configuration.assessmentFocus)}</p>
          <button className="staff-builder-secondary-button" onClick={() => openStoredRun(latestCompleted)} type="button">Open Report</button>
        </> : <p>The latest completed report cannot be opened with this version ({parsed.reason}).</p>; })()}
        {parsePiecePracticeRun(latestCompleted).ok ? null : <button className="staff-builder-danger-button" onClick={() => discardStoredRun(latestCompleted)} type="button">Discard</button>}
      </section> : null}

      <div aria-live="polite" className="space-y-2">
        {pieceFileStatus && <div className={pieceFileStatus.kind === "error" ? "staff-builder-storage-error" : "text-emerald-300"} role={pieceFileStatus.kind === "error" ? "alert" : "status"}>{pieceFileStatus.message}</div>}
        {practiceLaunchError && <div className="staff-builder-storage-error" role="alert">{practiceLaunchError}</div>}
        {preferenceError && <div className="staff-builder-storage-error" role="alert">{preferenceError} Changes remain available in memory, but may not be saved.</div>}
        {state.issues.map((issue, index) => <div className="staff-builder-storage-error" key={`${issue.area}-${index}`}>
          <span>{issue.message} Changes remain available in memory, but may not be saved.</span>
          {issue.clearable && <button className="staff-builder-danger-button" onClick={() => {
            if (window.confirm(`Clear the ${issue.area} Staff Builder data?`)) state.clearCorruptArea(issue.area as "library" | "draft");
          }} type="button">Clear {issue.area} data</button>}
        </div>)}
      </div>

      {state.recoveryDraft && <section className="staff-builder-recovery" role="alert">
        <strong>A newer Staff Builder draft is available.</strong>
        <div className="flex gap-2"><button className="staff-builder-secondary-button" onClick={state.restoreDraft} type="button">Restore Draft</button><button className="staff-builder-secondary-button" onClick={state.declineDraft} type="button">Use Saved Version</button></div>
      </section>}

      {state.activeScore
        ? <div className="staff-builder-editor-layout"><StaffBuilderWorkspacePlaceholder
              initialCaptureState={state.activeCaptureState}
              initialEditorPass={state.activeEditorPass}
              initialRhythmState={state.activeRhythmState}
              key={state.activeScore.id}
              onClose={state.closePiece}
              onDraftChange={state.updateActiveDraft}
              onPracticePiece={launchPiecePractice}
              onValidatedSave={state.validateAndSave}
              savingAvailable={!state.issues.some(({ area }) => area === "library" || area === "draft")}
              score={state.activeScore}
              sustainPedalLocksInput={sustainPedalLocksInput}
              onSustainPedalLocksInputChange={(enabled) => {
                setSustainPedalLocksInput(enabled);
                const result = writeStaffBuilderValue(storage, "sustainPedalLocksInput", enabled);
                setPreferenceError(result.ok ? null : result.message);
              }}
              validatedSavedSnapshot={state.lastValidatedSavedSnapshot}
            /></div>
        : <div className="staff-builder-columns">
            <StaffBuilderLibrary activePieceId={state.activeSavedPieceId} onDelete={state.deletePiece} onDownload={(score) => {
              try {
                downloadStaffBuilderPiece(score);
                setPieceFileStatus({ kind: "success", message: `Downloaded "${score.title}".` });
              } catch {
                setPieceFileStatus({ kind: "error", message: "Prelude could not download that piece. Try again." });
              }
            }} onDuplicate={state.duplicatePiece} onImportFile={(file) => {
              void readStaffBuilderPieceFile(file).then((result) => {
                if (!result.ok) {
                  setPieceFileStatus({ kind: "error", message: result.message });
                  return;
                }
                const imported = state.importPiece(result.score);
                setPieceFileStatus({
                  kind: imported.persisted ? "success" : "error",
                  message: imported.persisted
                    ? `Imported "${imported.score.title}".`
                    : `Imported "${imported.score.title}" in memory, but it could not be saved in this browser.`,
                });
              });
            }} onOpen={state.openPiece} onPractice={launchPiecePractice} onPrint={setPrintPiece} onRename={state.renamePiece} pieces={state.library.pieces} practiceMetadataByPieceId={state.library.practiceMetadataByPieceId} />
            <StaffBuilderPieceSetup onCreate={state.createPiece} />
          </div>}
      {state.introductionOpen && <StaffBuilderIntroduction onClose={state.closeIntroduction} returnFocusRef={introductionOpenerRef} />}
      {printPiece && <StaffBuilderPrintFlow onClose={() => setPrintPiece(null)} score={printPiece} />}
    </div>
  );
}
