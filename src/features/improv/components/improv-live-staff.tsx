import { memo } from "react";
import { spellFreeplayMidiNumbers, type FreeplayNotationContext } from "@/features/freeplay/freeplay-notation";
import type { ImprovTimeline } from "../improv-timeline";
import { ImprovPerformanceStaff } from "./improv-performance-staff";

export const ImprovLiveStaff = memo(function ImprovLiveStaff({ pitches, context, source }: Readonly<{
  pitches: readonly number[]; context: FreeplayNotationContext; source: () => ImprovTimeline | null;
}>) {
  const notes = spellFreeplayMidiNumbers({ context, midiNumbers: pitches }) ?? [];
  const names = notes.length ? notes.map(n => `${n.name}${n.octave}`).join(", ") : "No held notes";
  return <div className="improv-live min-w-0 rounded-xl border border-white/10 bg-white/5">
    <ImprovPerformanceStaff source={source} context={context} />
    <p className="break-words border-t border-white/10 px-3 py-2 text-center text-sm" aria-live="off">Held keys: <span aria-live="off">{names}</span></p>
  </div>;
});
