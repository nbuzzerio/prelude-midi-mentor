import { useRef } from "react";
import { StaffBuilderIntroduction } from "./staff-builder-introduction";
import { StaffBuilderLibrary } from "./staff-builder-library";
import { StaffBuilderPieceSetup } from "./staff-builder-piece-setup";
import { StaffBuilderWorkspacePlaceholder } from "./staff-builder-workspace-placeholder";
import { useStaffBuilderLibrary } from "../hooks/use-staff-builder-library";
import type { StaffBuilderStorage } from "../persistence/staff-builder-storage";

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
  const introductionOpenerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="staff-builder-shell">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Staff Builder</h1><p className="text-zinc-300">Build a simplified, local practice reference.</p></div>
        <button className="staff-builder-secondary-button" onClick={state.reopenIntroduction} ref={introductionOpenerRef} type="button">About Staff Builder</button>
      </header>

      <aside className="staff-builder-storage-notice">
        <strong>Pieces are stored only in this browser and device.</strong> Clearing browser data may delete pieces. Pieces are not synced; JSON import and export will be added later.
      </aside>

      <div aria-live="polite" className="space-y-2">
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

      <div className="staff-builder-columns">
        <StaffBuilderLibrary activePieceId={state.activeSavedPieceId} onDelete={state.deletePiece} onOpen={state.openPiece} onRename={state.renamePiece} pieces={state.library.pieces} />
        {state.activeScore
          ? <StaffBuilderWorkspacePlaceholder
              initialCaptureState={state.activeCaptureState}
              key={state.activeScore.id}
              onClose={state.closePiece}
              onDraftChange={state.updateActiveDraft}
              savingAvailable={!state.issues.some(({ area }) => area === "library" || area === "draft")}
              score={state.activeScore}
            />
          : <StaffBuilderPieceSetup onCreate={state.createPiece} />}
      </div>
      {state.introductionOpen && <StaffBuilderIntroduction onClose={state.closeIntroduction} returnFocusRef={introductionOpenerRef} />}
    </div>
  );
}
