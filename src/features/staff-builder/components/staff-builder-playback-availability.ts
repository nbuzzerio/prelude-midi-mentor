import type { StaffBuilderEditorPass } from "../hooks/use-staff-builder-editor";
import type { StaffBuilderEvent } from "../staff-builder-types";

export type StaffBuilderPlaybackAvailability = Readonly<{
  auditionReady: boolean;
  auditionReason: string | null;
  fullPlaybackReady: boolean;
  fullPlaybackReason: string | null;
}>;

export function getStaffBuilderPlaybackAvailability(editorPass: StaffBuilderEditorPass, issueCount: number, selectedEvent: StaffBuilderEvent | null): StaffBuilderPlaybackAvailability {
  const fullPlaybackReady = issueCount === 0;
  const auditionReady = editorPass === "rhythm" && selectedEvent?.kind === "notes" && selectedEvent.rhythm.status === "final";
  return {
    auditionReady,
    auditionReason: auditionReady ? null : "Select a finished note or chord in Rhythm Correction to audition it.",
    fullPlaybackReady,
    fullPlaybackReason: fullPlaybackReady ? null : `Playback unavailable: ${issueCount} score ${issueCount === 1 ? "issue remains" : "issues remain"}.`,
  };
}
