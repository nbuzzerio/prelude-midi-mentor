import type { ContinuousAttempt } from "./continuous-types";

export function ContinuousInputDiagnostic({ attempt }: Readonly<{ attempt: ContinuousAttempt }>) {
  if (!attempt.assessment || attempt.attacks.length || !attempt.performanceStartedAt) return null;
  return <div role="note" className="rounded border border-amber-400 p-3 text-amber-100">
    <p className="font-semibold">No MIDI note attacks were captured during this performance.</p>
    <p>This may reflect silence or an input-selection/connection problem. Verify the selected physical MIDI input before replaying.</p>
  </div>;
}
