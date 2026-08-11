import { useRef, useState } from "react";
import { PiecePracticeSession } from "@/features/piece-practice/components/piece-practice-session";
import { projectStaffBuilderPieceForPractice } from "@/features/piece-practice/piece-practice-projection";
import type { PiecePracticePiece } from "@/features/piece-practice/piece-practice-types";
import { StaffBuilderIntroduction } from "./staff-builder-introduction";
import { StaffBuilderLibrary } from "./staff-builder-library";
import { StaffBuilderPieceSetup } from "./staff-builder-piece-setup";
import { StaffBuilderWorkspacePlaceholder } from "./staff-builder-workspace-placeholder";
import { useStaffBuilderLibrary } from "../hooks/use-staff-builder-library";
import type { StaffBuilderStorage } from "../persistence/staff-builder-storage";
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
  const state = useStaffBuilderLibrary(storage);
  const [practicePiece, setPracticePiece] = useState<PiecePracticePiece | null>(null);
  const [practiceLaunchError, setPracticeLaunchError] = useState<string | null>(null);
  const [pieceFileStatus, setPieceFileStatus] = useState<Readonly<{ kind: "error" | "success"; message: string }> | null>(null);
  const introductionOpenerRef = useRef<HTMLButtonElement>(null);
  if (practicePiece) {
    return <PiecePracticeSession onExit={() => setPracticePiece(null)} piece={practicePiece} />;
  }
  return (
    <div className="staff-builder-shell">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Staff Builder</h1><p className="text-zinc-300">Build a simplified, local practice reference.</p></div>
        <button className="staff-builder-secondary-button" onClick={state.reopenIntroduction} ref={introductionOpenerRef} type="button">About Staff Builder</button>
      </header>

      <aside className="staff-builder-storage-notice">
        <strong>Pieces are stored only in this browser and device.</strong> Clearing browser data may delete pieces. Pieces are not synced; download Prelude piece files to keep backups you can import later.
      </aside>

      <div aria-live="polite" className="space-y-2">
        {pieceFileStatus && <div className={pieceFileStatus.kind === "error" ? "staff-builder-storage-error" : "text-emerald-300"} role={pieceFileStatus.kind === "error" ? "alert" : "status"}>{pieceFileStatus.message}</div>}
        {practiceLaunchError && <div className="staff-builder-storage-error" role="alert">{practiceLaunchError}</div>}
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
              onValidatedSave={state.validateAndSave}
              savingAvailable={!state.issues.some(({ area }) => area === "library" || area === "draft")}
              score={state.activeScore}
            /></div>
        : <div className="staff-builder-columns">
            <StaffBuilderLibrary activePieceId={state.activeSavedPieceId} onDelete={state.deletePiece} onDownload={(score) => {
              try {
                downloadStaffBuilderPiece(score);
                setPieceFileStatus({ kind: "success", message: `Downloaded "${score.title}".` });
              } catch {
                setPieceFileStatus({ kind: "error", message: "Prelude could not download that piece. Try again." });
              }
            }} onImportFile={(file) => {
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
            }} onOpen={state.openPiece} onPractice={(score) => {
              const projection = projectStaffBuilderPieceForPractice(score);
              if (!projection.ok) {
                setPracticeLaunchError("This piece could not be opened for practice because it is not structurally valid.");
                return;
              }
              setPracticeLaunchError(null);
              setPracticePiece(projection.piece);
            }} onRename={state.renamePiece} pieces={state.library.pieces} />
            <StaffBuilderPieceSetup onCreate={state.createPiece} />
          </div>}
      {state.introductionOpen && <StaffBuilderIntroduction onClose={state.closeIntroduction} returnFocusRef={introductionOpenerRef} />}
    </div>
  );
}
