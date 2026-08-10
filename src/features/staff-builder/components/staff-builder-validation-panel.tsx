import { useEffect, useRef } from "react";
import type { StaffBuilderIssue } from "../staff-builder-validation";

export function StaffBuilderValidationPanel({ issues, activeIssue, activeIndex, status, onActivate, onClose, onPrevious, onNext, onCorrection, onFillAllGaps, showClose = true }: Readonly<{
  issues: readonly StaffBuilderIssue[];
  activeIssue: StaffBuilderIssue | null;
  activeIndex: number;
  status: string | null;
  onActivate: () => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onCorrection: (correction: StaffBuilderIssue["corrections"][number]) => void;
  onFillAllGaps: () => void;
  showClose?: boolean;
}>) {
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (activeIssue) descriptionRef.current?.focus(); }, [activeIssue]);
  if (!activeIssue) return <section aria-label="Save" className="staff-builder-validation-panel"><button className="staff-builder-primary-button" onClick={onActivate} type="button">Save</button>{status && <p aria-live="polite" role="status">{status}</p>}</section>;
  const safeGapCount = issues.filter((currentIssue) => currentIssue.code === "gap" && currentIssue.corrections.some(({ kind }) => kind === "fill-gap-with-rests")).length;
  return <section className="staff-builder-validation-panel" aria-labelledby="staff-builder-validation-title">
    <div className="staff-builder-rhythm-heading"><div><h3 id="staff-builder-validation-title">Structural correction</h3><p>Issue {activeIndex + 1} of {issues.length}</p></div>{showClose && <button className="staff-builder-secondary-button" onClick={onClose} type="button">Close Correction Mode</button>}</div>
    <p className="staff-builder-issue-description" ref={descriptionRef} tabIndex={-1}>{activeIssue.message}</p>
    {activeIssue.corrections.map((correction) => correction.kind === "set-duration"
      ? <p key={`suggestion-${correction.eventId}`}>Change it to a {correction.duration.replace("-", " ")} note so it ends at the barline.</p>
      : null)}
    <p>Measure {activeIssue.target.measureIndex + 1}{activeIssue.target.staff ? `, ${activeIssue.target.staff} staff` : ""}{activeIssue.code !== "gap" && activeIssue.target.positionTicks !== undefined ? `, tick ${activeIssue.target.positionTicks}` : ""}.</p>
    <div className="staff-builder-capture-actions"><button className="staff-builder-secondary-button" disabled={activeIndex <= 0} onClick={onPrevious} type="button">Previous Issue</button><button className="staff-builder-secondary-button" disabled={activeIndex >= issues.length - 1} onClick={onNext} type="button">Next Issue</button></div>
    <div className="staff-builder-capture-actions">{activeIssue.corrections.map((correction, index) => {
      const label = correction.kind === "fill-gap-with-rests" ? "Add Rest"
        : correction.kind === "remove-tie" ? `Remove tie ${correction.tieId}`
          : correction.kind === "delete-event" ? `Delete event ${correction.eventId}`
            : correction.kind === "assign-duration" ? "Assign duration in Rhythm Correction"
              : correction.kind === "set-duration" ? `Change to ${correction.duration.replace("-", " ")}`
                : "Shorten duration in Rhythm Correction";
      return <button className={correction.kind === "delete-event" ? "staff-builder-danger-button" : "staff-builder-secondary-button"} key={`${correction.kind}-${index}`} onClick={() => onCorrection(correction)} type="button">{label}</button>;
    })}{activeIssue.code === "gap" && safeGapCount > 1 && <button className="staff-builder-secondary-button" onClick={onFillAllGaps} type="button">Fill All Empty Beats With Rests</button>}</div>
    <p>The draft remains autosaved while issues are corrected.</p>{status && <p aria-live="polite" role="status">{status}</p>}
  </section>;
}
