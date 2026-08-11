import { useRef } from "react";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { validateStaffBuilderScore } from "../staff-builder-validation";

export function StaffBuilderLibrary({ activePieceId, pieces, onDelete, onDownload, onImportFile, onOpen, onPractice, onRename }: Readonly<{
  activePieceId: string | null;
  pieces: readonly StaffBuilderScoreV1[];
  onDelete: (id: string) => void;
  onDownload: (piece: StaffBuilderScoreV1) => void;
  onImportFile: (file: File) => void;
  onOpen: (id: string) => void;
  onPractice: (piece: StaffBuilderScoreV1) => void;
  onRename: (id: string, title: string) => void;
}>) {
  const importInputRef = useRef<HTMLInputElement>(null);
  return (
    <section className="staff-builder-panel" aria-labelledby="staff-builder-library-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold" id="staff-builder-library-title">Piece library</h2>
        <button className="staff-builder-secondary-button" onClick={() => importInputRef.current?.click()} type="button">Import Piece</button>
        <input accept=".prelude.json,application/json" aria-label="Choose Prelude piece file" className="sr-only" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onImportFile(file);
        }} ref={importInputRef} type="file" />
      </div>
      {pieces.length === 0 ? <p>No Staff Builder pieces yet.</p> : (
        <ul className="staff-builder-library-list">
          {pieces.map((piece) => {
            const practiceEligible = validateStaffBuilderScore(piece).length === 0;
            const practiceReasonId = `staff-builder-practice-reason-${piece.id}`;
            return (
              <li className="staff-builder-library-item" key={piece.id}>
                <div><strong>{piece.title}</strong>{activePieceId === piece.id && <span className="ml-2 text-sky-300">Current piece</span>}<span className={practiceEligible ? "ml-2 text-emerald-300" : "ml-2 text-amber-300"}>{practiceEligible ? "Validated" : "Needs validation"}</span><div className="text-sm text-zinc-400">Updated {new Date(piece.updatedAt).toLocaleString()}</div>{!practiceEligible && <div className="text-sm text-amber-200" id={practiceReasonId}>Complete structural validation before practicing this piece.</div>}</div>
                <div className="flex flex-wrap gap-2">
                  <button aria-label={`Open ${piece.title}`} className="staff-builder-secondary-button" onClick={() => onOpen(piece.id)} type="button">Open</button>
                  <button aria-describedby={!practiceEligible ? practiceReasonId : undefined} aria-label={`Practice ${piece.title}`} className="staff-builder-secondary-button" disabled={!practiceEligible} onClick={() => onPractice(piece)} title={!practiceEligible ? "Complete structural validation before practicing this piece." : undefined} type="button">Practice</button>
                  <button aria-label={`Download ${piece.title}`} className="staff-builder-secondary-button" onClick={() => onDownload(piece)} type="button">Download</button>
                  <button aria-label={`Rename ${piece.title}`} className="staff-builder-secondary-button" onClick={() => {
                    const title = window.prompt(`Rename ${piece.title}`, piece.title);
                    if (title?.trim()) onRename(piece.id, title);
                  }} type="button">Rename</button>
                  <button aria-label={`Delete ${piece.title}`} className="staff-builder-danger-button" onClick={() => {
                    if (window.confirm(`Delete ${piece.title}? This cannot be undone.`)) onDelete(piece.id);
                  }} type="button">Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
