import { useId, useState } from "react";
import type { InstrumentPitchContext } from "../instrument-pitch-context";
import { getViolinLivePosition, selectViolinExpectedPosition, VIOLIN_FIRST_POSITION_GUIDE, VIOLIN_STRINGS,
  violinPositionFraction, type ViolinPosition, type ViolinStringSelection } from "../violin-first-position";

const NUT_Y = 80, LENGTH = 480;
const stringX = (id: string) => 63 + VIOLIN_STRINGS.findIndex((string) => string.stringId === id) * 78;

/** Advisory presentation only. Owns no capture, calibration, grading or saved-run state. */
export function ViolinFingerboard({ context }: Readonly<{ context: InstrumentPitchContext }>) {
  const [selection, setSelection] = useState<ViolinStringSelection>("auto");
  const [stickers, setStickers] = useState(true);
  const id = useId();
  const expected = selectViolinExpectedPosition(context.expected?.semitone ?? null, selection);
  const live = getViolinLivePosition(context, expected.stringId);
  const pitchLabel = (semitone: number) => context.pitchLabels[semitone] ?? `MIDI ${semitone}`;
  const marker = (kind: "expected" | "live", position: ViolinPosition) => {
    const x = stringX(position.stringId), y = NUT_Y + LENGTH * position.fraction;
    // Separate shapes remain distinguishable when both pitches share a location.
    return <g data-violin-marker={kind} data-string={position.stringId} data-midi={position.semitone} transform={`translate(${x}, ${y})`}>
      <title>{kind === "expected" ? "Expected" : "Live pitch-derived possible position"}: {pitchLabel(position.semitone)}, {position.stringId} string, {position.label}</title>
      {kind === "expected" ? <path d="M 0 -11 L 11 0 L 0 11 L -11 0 Z" fill="#0369a1" stroke="#e0f2fe" strokeWidth="2" />
        : <circle r="16" fill="none" stroke="#fbbf24" strokeWidth="3" strokeDasharray="4 2" />}
    </g>;
  };
  return <aside aria-label="Violin first-position guide" className="grid min-w-0 content-start gap-3 rounded-lg border border-sky-400/50 bg-zinc-900 p-3">
    <h2 className="text-xl font-bold">Violin fingerboard</h2>
    <p className="text-sm text-zinc-300">Pitch suggests a possible location; the microphone cannot identify your actual string or finger.</p>
    <label className="grid gap-1 font-semibold">String for diagram<select className="min-h-11 w-full min-w-0 rounded border border-zinc-500 bg-zinc-950 px-2"
      value={selection} onChange={(event) => setSelection(event.target.value as ViolinStringSelection)}>
      <option value="auto">Suggested string (automatic)</option>{VIOLIN_STRINGS.map((string) => <option key={string.stringId} value={string.stringId}>{string.stringId} string · {string.note}</option>)}
    </select></label>
    <p aria-label="Diagram string assumption" className="min-h-6 font-semibold">{expected.stringId ? `${expected.provenance} string: ${expected.stringId}` : "No suggested string for this target"}</p>
    <div aria-label="Expected fingerboard position" className="min-h-20 rounded border border-sky-300 bg-sky-950/30 p-2">
      <p className="text-xl font-bold">◇ Expected: {context.expected?.label ?? "—"}</p>
      <p>{expected.position ? `${expected.provenance} ${expected.position.stringId} string · ${expected.position.label === "Open" ? "Open string" : `finger ${expected.position.label}`}`
        : !context.expected ? "No current target." : expected.locations.length === 0 ? "This pitch is outside the modeled first-position guide."
          : `Selected ${expected.stringId} string cannot produce this pitch in the modeled first position.`}</p>
    </div>
    <div aria-label="Live fingerboard position" className="min-h-24 rounded border border-amber-300 bg-amber-950/20 p-2">
      <p className="font-bold">◌ Live pitch: {context.live.state === "live" && context.live.pitch ? pitchLabel(context.live.pitch.semitone) : "—"}</p>
      <p>{live.message}</p>
    </div>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={stickers} onChange={(event) => setStickers(event.target.checked)} />Show pitch-name stickers</label>
    <svg role="img" aria-labelledby={`${id}-title ${id}-description`} viewBox="0 0 360 600" className="w-full min-w-0 max-w-sm justify-self-center">
      <title id={`${id}-title`}>Advisory violin first-position fingerboard</title>
      <desc id={`${id}-description`}>Nut at top, bridge at bottom. G, D, A, E strings left to right. Diamond marks expected pitch; dashed circle marks a live pitch-derived possible location. Locations do not identify physical fingering.</desc>
      <path d="M 50 65 L 310 65 L 325 565 L 35 565 Z" fill="#18181b" stroke="#71717a" />
      <rect x="36" y="65" width="289" height={NUT_Y + LENGTH * violinPositionFraction(7)! - 65 + 15} fill="#082f49" opacity="0.5" />
      {VIOLIN_STRINGS.map((string, index) => <g key={string.stringId}>
        <text x={stringX(string.stringId)} y="28" textAnchor="middle" fill="#fafafa" fontSize="17" fontWeight="bold">{string.note}</text>
        <line x1={stringX(string.stringId)} x2={stringX(string.stringId)} y1={NUT_Y} y2={NUT_Y + LENGTH} stroke="#d4d4d8" strokeWidth={3 - index * 0.5} />
        {VIOLIN_FIRST_POSITION_GUIDE.map((position) => {
          const y = NUT_Y + LENGTH * violinPositionFraction(position.offset)!;
          return <g key={position.offset}><circle cx={stringX(string.stringId)} cy={y} r="3" fill="#a1a1aa" />
            {stickers && <text data-violin-sticker={`${string.stringId}:${position.offset}`} x={stringX(string.stringId) + 7} y={position.offset === 0 ? y - 12 : y + 5} fill="#e4e4e7" fontSize="14">{pitchLabel(string.semitone + position.offset)}</text>}
          </g>;
        })}
      </g>)}
      <line x1="35" x2="325" y1={NUT_Y} y2={NUT_Y} stroke="#fafafa" strokeWidth="4" />
      <text x="180" y="52" textAnchor="middle" fill="#fafafa" fontSize="15">Nut · open strings</text>
      {VIOLIN_FIRST_POSITION_GUIDE.slice(1).map((position) => <text key={position.offset} x="5" y={NUT_Y + LENGTH * violinPositionFraction(position.offset)! + 5} fill="#cbd5e1" fontSize="12">{position.label}</text>)}
      <text x="180" y="325" textAnchor="middle" fill="#a1a1aa" fontSize="15">Higher positions</text>
      <text x="180" y="347" textAnchor="middle" fill="#a1a1aa" fontSize="15">not modeled</text>
      <line x1="30" x2="330" y1={NUT_Y + LENGTH} y2={NUT_Y + LENGTH} stroke="#d4d4d8" strokeWidth="6" />
      <text x="180" y="588" textAnchor="middle" fill="#fafafa" fontSize="15">Bridge · pitch rises toward bridge ↓</text>
      {expected.position && marker("expected", expected.position)}{live.position && marker("live", live.position)}
    </svg>
    <div aria-label="Alternate first-position locations" className="grid gap-2 text-sm">
      <p className="font-semibold">Supported locations for {context.expected?.label ?? "this target"}</p>
      {expected.locations.map((position) => <button key={position.stringId} type="button" className="min-h-11 rounded border border-zinc-500 px-2 text-left"
        onClick={() => setSelection(position.stringId)}>Use {position.stringId} string · {position.label === "Open" ? "Open string" : `finger ${position.label}`}</button>)}
      {expected.locations.length < 2 && <p>{expected.locations.length ? "No alternate string in this bounded guide." : "No supported first-position location."}</p>}
    </div>
    <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Diagram assumptions</summary>
      <p className="text-sm text-zinc-300">Common beginner suggestions, not universal fingerings. A4 = 440 Hz; equal temperament. Schematic positions use x/L = 1 − 2^(−n/12), not measured finger distances. Calibration does not offset the diagram. Confirmed tuning and last graded attempts remain separate evidence. Acceptance means pitch/attack, not written duration. Possible harmonics or different octave notes suppress the live marker; other octave errors may remain undetected.</p>
    </details>
  </aside>;
}
