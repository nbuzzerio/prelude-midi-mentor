import { getMusicKeyDefinition } from "@/lib/music/keys";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { StaffBuilderScoreView } from "./staff-builder-score-view";

export function StaffBuilderWorkspacePlaceholder({ score, onClose, savingAvailable }: Readonly<{ score: StaffBuilderScoreV1; onClose: () => void; savingAvailable: boolean }>) {
  return (
    <section className="staff-builder-panel" aria-labelledby="staff-builder-workspace-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-semibold" id="staff-builder-workspace-title">{score.title}</h2><p className={savingAvailable ? "text-sky-300" : "text-amber-300"}>{savingAvailable ? "Saved locally · Draft active" : "In memory · Local saving unavailable"}</p></div>
        <button className="staff-builder-secondary-button" onClick={() => {
          if (window.confirm("Close this piece and clear its active draft?")) onClose();
        }} type="button">Back to Library</button>
      </div>
      <dl className="staff-builder-metadata">
        <div><dt>Key</dt><dd>{getMusicKeyDefinition(score.initialKeySignatureId).name}</dd></div>
        <div><dt>Time</dt><dd>{score.initialTimeSignature}</dd></div>
        <div><dt>Tempo</dt><dd>{score.tempoBpm} BPM</dd></div>
      </dl>
      <StaffBuilderScoreView key={score.id} score={score} />
      <p className="mt-3 text-sm text-zinc-300">Note entry, event editing, and playback are not available yet.</p>
    </section>
  );
}
