import { useEffect, useState } from "react";
import { STAFF_BUILDER_LYRIC_CUE_MAX_LENGTH } from "../staff-builder-annotations";
import { formatStaffBuilderCapturePosition, type StaffBuilderCaptureState } from "../staff-builder-capture";
import { resolveStaffBuilderMeasureContext } from "../staff-builder-score";
import { resolveStaffBuilderLyricTarget, type StaffBuilderLyricTargetResolution } from "../staff-builder-lyric-authoring";
import type { StaffBuilderAnnotation, StaffBuilderScore } from "../staff-builder-types";
import type { StaffBuilderStepDuration } from "../staff-builder-time";

export function StaffBuilderLyricCuesPass({ score, captureState, selectedEventId, onSelectEvent, onCommitAndAdvance, onEntryChange, onPrevious, onStepDurationChange }: Readonly<{
  score: StaffBuilderScore;
  captureState: StaffBuilderCaptureState;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  onCommitAndAdvance: (text: string, eventId: string | null) => boolean;
  onEntryChange?: (text: string, eventId: string | null) => void;
  onPrevious: () => unknown;
  onStepDurationChange: (duration: StaffBuilderStepDuration) => unknown;
}>) {
  const resolution = resolveStaffBuilderLyricTarget(score, captureState.cursor.measureIndex, captureState.cursor.offsetTicks, selectedEventId);
  const cue = resolution.target ? score.annotations.find((annotation): annotation is Extract<StaffBuilderAnnotation, { kind: "lyric-cue" }> => annotation.kind === "lyric-cue" && annotation.anchor.kind === "event" && annotation.anchor.eventId === resolution.target?.id) : undefined;
  const sourceKey = `${captureState.cursor.measureIndex}:${captureState.cursor.offsetTicks}:${resolution.target?.id ?? "none"}:${cue?.id ?? ""}:${cue?.text ?? ""}`;
  const context = resolveStaffBuilderMeasureContext(score, captureState.cursor.measureIndex);
  const position = formatStaffBuilderCapturePosition(context.timeSignature, captureState.cursor.offsetTicks);
  return <section aria-labelledby="staff-builder-lyric-pass-title" className="staff-builder-lyric-pass">
    <div><h3 id="staff-builder-lyric-pass-title">Lyric Cues</h3><p>Measure {captureState.cursor.measureIndex + 1} · {position}</p></div>
    {resolution.ambiguous && <fieldset><legend>Choose the treble event at this position</legend>{resolution.candidates.map((event) => <label key={event.id}><input checked={resolution.target?.id === event.id} name="lyric-target" onChange={() => onSelectEvent(event.id)} type="radio" />{event.pitches.map(({ letter, accidental, octave }) => `${letter}${accidental === "sharp" ? "♯" : accidental === "flat" ? "♭" : ""}${octave}`).join(", ")}</label>)}</fieldset>}
    <StaffBuilderLyricCueEntry initialText={cue?.text ?? ""} key={sourceKey} onCommitAndAdvance={onCommitAndAdvance} onEntryChange={onEntryChange} onPrevious={onPrevious} resolution={resolution} />
    <label>Step Duration<select onChange={(event) => onStepDurationChange(event.target.value as StaffBuilderStepDuration)} value={captureState.stepDuration}><option value="quarter">Quarter</option><option value="eighth">Eighth</option><option value="sixteenth">Sixteenth</option></select></label>
    {!resolution.target && !resolution.ambiguous && <p>No eligible treble note or chord is present. Advancing will not create a cue.</p>}
    {resolution.ambiguous && <p aria-live="assertive" className="staff-builder-annotation-error" role="alert">Choose which treble event should receive this lyric cue.</p>}
  </section>;
}

function StaffBuilderLyricCueEntry({ initialText, resolution, onCommitAndAdvance, onEntryChange, onPrevious }: Readonly<{
  initialText: string;
  resolution: StaffBuilderLyricTargetResolution;
  onCommitAndAdvance: (text: string, eventId: string | null) => boolean;
  onEntryChange?: (text: string, eventId: string | null) => void;
  onPrevious: () => unknown;
}>) {
  const [text, setText] = useState(initialText);
  const eventId = resolution.target?.id ?? null;
  useEffect(() => onEntryChange?.(text, eventId), [eventId, onEntryChange, text]);
  const commit = () => onCommitAndAdvance(text, eventId);
  return <><label>Lyric Cue<input maxLength={STAFF_BUILDER_LYRIC_CUE_MAX_LENGTH} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} placeholder={resolution.target ? "Optional phrase cue" : "No treble event at this position"} type="text" value={text} /></label><div><button className="staff-builder-secondary-button" onClick={onPrevious} type="button">Previous Position</button><button className="staff-builder-primary-button" onClick={commit} type="button">Lock In / Next</button></div></>;
}
