import { useEffect, useRef } from "react";
import type { StaffBuilderIssue } from "../staff-builder-validation";

export function StaffBuilderValidationPanel({ issues, activeIssue, activeIndex, status, onActivate, onClose, onPrevious, onNext, onCorrection }: Readonly<{
  issues: readonly StaffBuilderIssue[];
  activeIssue: StaffBuilderIssue | null;
  activeIndex: number;
  status: string | null;
  onActivate: () => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onCorrection: (correction: StaffBuilderIssue["corrections"][number]) => void;
}>) {
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (activeIssue) descriptionRef.current?.focus(); }, [activeIssue]);
  if (!activeIssue) return <section className="staff-builder-validation-panel" aria-labelledby="staff-builder-validation-title"><h3 id="staff-builder-validation-title">Structural validation</h3><p>{issues.length} issues. The draft continues to autosave.</p><button className="staff-builder-primary-button" onClick={onActivate} type="button">Validate &amp; Save</button>{status && <p aria-live="polite" role="status">{status}</p>}</section>;
  return <section className="staff-builder-validation-panel" aria-labelledby="staff-builder-validation-title">
    <div className="staff-builder-rhythm-heading"><div><h3 id="staff-builder-validation-title">Structural correction</h3><p>Issue {activeIndex + 1} of {issues.length}</p></div><button className="staff-builder-secondary-button" onClick={onClose} type="button">Close Correction Mode</button></div>
    <p className="staff-builder-issue-description" ref={descriptionRef} tabIndex={-1}>{activeIssue.message}</p>
    <p>Measure {activeIssue.target.measureIndex + 1}{activeIssue.target.staff ? `, ${activeIssue.target.staff} staff` : ""}{activeIssue.target.positionTicks !== undefined ? `, tick ${activeIssue.target.positionTicks}` : ""}.</p>
    <div className="staff-builder-capture-actions"><button className="staff-builder-secondary-button" disabled={activeIndex <= 0} onClick={onPrevious} type="button">Previous Issue</button><button className="staff-builder-secondary-button" disabled={activeIndex >= issues.length - 1} onClick={onNext} type="button">Next Issue</button></div>
    <div className="staff-builder-capture-actions">{activeIssue.corrections.map((correction, index) => {
      const label = correction.kind === "fill-gap-with-rests" ? `Fill ${activeIssue.target.staff ?? "staff"} gap with rests`
        : correction.kind === "remove-tie" ? `Remove tie ${correction.tieId}`
          : correction.kind === "delete-event" ? `Delete event ${correction.eventId}`
            : correction.kind === "assign-duration" ? "Assign duration in Rhythm Correction"
              : "Shorten duration in Rhythm Correction";
      return <button className={correction.kind === "delete-event" ? "staff-builder-danger-button" : "staff-builder-secondary-button"} key={`${correction.kind}-${index}`} onClick={() => onCorrection(correction)} type="button">{label}</button>;
    })}</div>
    <p>The draft remains autosaved while issues are corrected.</p>{status && <p aria-live="polite" role="status">{status}</p>}
  </section>;
}
