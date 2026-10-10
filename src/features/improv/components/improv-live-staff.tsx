import { Component, memo, type ReactNode } from "react";
import MusicStaff from "@/components/notation/music-staff";
import { spellFreeplayMidiNumbers, type FreeplayNotationContext } from "@/features/freeplay/freeplay-notation";

class StaffFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="p-4 text-zinc-300">Notation is unavailable. Use the held-note names below.</p> : this.props.children; }
}
export const ImprovLiveStaff = memo(function ImprovLiveStaff({ pitches, context }: Readonly<{ pitches: readonly number[]; context: FreeplayNotationContext }>) {
  const notes = spellFreeplayMidiNumbers({ context, midiNumbers: pitches, preference: "automatic" }) ?? [];
  const names = notes.length ? notes.map((n) => `${n.name}${n.octave}`).join(", ") : pitches.length ? pitches.map((p) => `MIDI ${p}`).join(", ") : "No held notes";
  return <div className="improv-live min-w-0 rounded-xl border border-white/10 bg-white/5">
    <p className="break-words border-t border-white/10 p-3 text-center text-lg" aria-live="off">{names}</p>
    <StaffFallback key={`${JSON.stringify(context)}:${pitches.join(",")}`}><MusicStaff mode="freeplay" heldNotes={notes} keySignatureId={context.type === "key" ? context.keyId : undefined} /></StaffFallback>
    <p className="px-3 pb-3 text-center text-xs text-zinc-400">Live held keys · display only, not a transcription</p>
  </div>;
});
