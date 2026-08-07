import { useRef, useState } from "react";
import type { NoteLetter } from "@/lib/music/note-utils";
import { getStaffBuilderPitchSpellingCandidates } from "../staff-builder-rhythm";
import { STAFF_BUILDER_DURATIONS, type StaffBuilderDuration } from "../staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderStaff } from "../staff-builder-types";

const durationLabel = (duration: StaffBuilderDuration) => duration.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");

export function StaffBuilderRhythmControls({ selectedEvent, selectedDescription, selectedIndex, eventCount, canPrevious, canNext, canUndo, canRedo, status, onPrevious, onNext, onAssignDuration, onConvertToRest, onMoveToStaff, onRespellPitch, onDelete, onUndo, onRedo }: Readonly<{
  selectedEvent: StaffBuilderEvent | null;
  selectedDescription: string;
  selectedIndex: number;
  eventCount: number;
  canPrevious: boolean;
  canNext: boolean;
  canUndo: boolean;
  canRedo: boolean;
  status: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onAssignDuration: (duration: StaffBuilderDuration) => void;
  onConvertToRest: (duration: StaffBuilderDuration) => void;
  onMoveToStaff: (staff: StaffBuilderStaff) => void;
  onRespellPitch: (pitchId: string, letter: NoteLetter) => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
}>) {
  const rhythmSignature = `${selectedEvent?.id ?? "none"}:${selectedEvent?.rhythm.status ?? "none"}:${selectedEvent?.rhythm.status === "final" ? selectedEvent.rhythm.duration : ""}`;
  const defaultDuration = selectedEvent?.rhythm.status === "final" ? selectedEvent.rhythm.duration : "";
  const [targetSelection, setTargetSelection] = useState<Readonly<{ rhythmSignature: string; duration: StaffBuilderDuration | "" }>>({ rhythmSignature, duration: defaultDuration });
  const targetDuration = targetSelection.rhythmSignature === rhythmSignature ? targetSelection.duration : defaultDuration;
  const selectedStatusRef = useRef<HTMLParagraphElement>(null);
  const hasDuration = targetDuration !== "";
  return (
    <section aria-labelledby="staff-builder-rhythm-title" className="staff-builder-rhythm-controls">
      <div className="staff-builder-rhythm-heading"><div><h3 className="font-semibold" id="staff-builder-rhythm-title">Rhythm Correction</h3><p>Event {selectedIndex + 1} of {eventCount}</p></div><div className="flex gap-2"><button className="staff-builder-secondary-button" disabled={!canUndo} onClick={onUndo} type="button">Undo</button><button className="staff-builder-secondary-button" disabled={!canRedo} onClick={onRedo} type="button">Redo</button></div></div>
      <p aria-live="polite" ref={selectedStatusRef} tabIndex={-1}>{selectedDescription}</p>
      <div className="staff-builder-capture-actions"><button className="staff-builder-secondary-button" disabled={!canPrevious} onClick={onPrevious} type="button">Previous Event</button><button className="staff-builder-secondary-button" disabled={!canNext} onClick={onNext} type="button">Next Event</button></div>
      {selectedEvent && <>
        <div className="staff-builder-rhythm-edit-grid">
          <label>Target Duration<select className="staff-builder-input" onChange={(event) => setTargetSelection({ rhythmSignature, duration: event.target.value as StaffBuilderDuration | "" })} value={targetDuration}><option value="">Choose duration</option>{STAFF_BUILDER_DURATIONS.map((duration) => <option key={duration} value={duration}>{durationLabel(duration)}</option>)}</select></label>
          <button className="staff-builder-primary-button" disabled={!hasDuration} onClick={() => hasDuration && onAssignDuration(targetDuration)} type="button">Assign Duration</button>
          {selectedEvent.kind === "notes" && <button className="staff-builder-secondary-button" disabled={!hasDuration} onClick={() => hasDuration && onConvertToRest(targetDuration)} type="button">Convert to Rest</button>}
        </div>
        <fieldset><legend>Staff</legend><div className="flex gap-2">{(["treble", "bass"] as const).map((staff) => <button aria-pressed={selectedEvent.staff === staff} className="staff-builder-secondary-button" key={staff} onClick={() => onMoveToStaff(staff)} type="button">{staff === "treble" ? "Treble" : "Bass"}</button>)}</div></fieldset>
        {selectedEvent.kind === "notes" && <div className="staff-builder-spelling-controls"><strong>Pitch spelling</strong>{[...selectedEvent.pitches].sort((left, right) => left.midiNumber - right.midiNumber || left.id.localeCompare(right.id)).map((pitch) => {
          const candidates = getStaffBuilderPitchSpellingCandidates(pitch);
          return <label key={pitch.id}>MIDI {pitch.midiNumber}<select className="staff-builder-input" disabled={candidates.length < 2} onChange={(event) => onRespellPitch(pitch.id, event.target.value as NoteLetter)} value={pitch.letter}>{candidates.map((candidate) => <option key={candidate.letter} value={candidate.letter}>{candidate.letter}{candidate.accidental === "sharp" ? "♯" : candidate.accidental === "flat" ? "♭" : ""}{candidate.octave}</option>)}</select></label>;
        })}</div>}
        <button className="staff-builder-danger-button" onClick={() => { selectedStatusRef.current?.focus(); onDelete(); }} type="button">Delete Event</button>
      </>}
      {status && <p aria-live="polite" className="text-amber-300" role="status">{status}</p>}
    </section>
  );
}
