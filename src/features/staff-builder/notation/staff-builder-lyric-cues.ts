import type { RenderContext, StemmableNote } from "vexflow";
import type { StaffBuilderLyricCueAnnotation, StaffBuilderScore } from "../staff-builder-types";

export const STAFF_BUILDER_LYRIC_LANE_RESERVATION = 24;

export function getStaffBuilderLyricCues(score: StaffBuilderScore, eventIds: ReadonlySet<string>): readonly StaffBuilderLyricCueAnnotation[] {
  return score.annotations.filter((annotation): annotation is StaffBuilderLyricCueAnnotation => annotation.kind === "lyric-cue"
    && annotation.anchor.kind === "event" && eventIds.has(annotation.anchor.eventId));
}

export function drawStaffBuilderLyricCues(
  context: RenderContext,
  cues: readonly StaffBuilderLyricCueAnnotation[],
  notes: ReadonlyMap<string, StemmableNote>,
  laneY: number,
  left: number,
  right: number,
): void {
  context.save().setFont("Arial", 12, "normal").setFillStyle("#52525b");
  for (const cue of cues) {
    if (cue.anchor.kind !== "event") continue;
    const note = notes.get(cue.anchor.eventId);
    if (!note) continue;
    const width = context.measureText(cue.text).width;
    const x = Math.max(left, Math.min(note.getAbsoluteX() - width / 2, right - width));
    context.fillText(cue.text, x, laneY);
  }
  context.restore();
}
