import { useId } from "react";
import type { InstrumentPitchContext } from "../instrument-pitch-context";
import { getOcarinaFingering, getOcarinaLiveFingering, OCARINA_HOLES, OCARINA_PROFILE, ocarinaFingeringInstruction,
  type OcarinaFingering, type OcarinaHoleId } from "../ocarina-fingering";

// Schematic player hand order in BOTH views; not a mirrored photograph or drilling template.
// Changing physical layout never changes the logical profile.
const FRONT: readonly Readonly<{ id: OcarinaHoleId; x: number; y: number; subhole?: boolean }>[] = [
  { id: "LP", x: 53, y: 88 }, { id: "LR", x: 91, y: 88 }, { id: "LM", x: 129, y: 88 }, { id: "LI", x: 167, y: 88 },
  { id: "RI", x: 213, y: 88 }, { id: "RM", x: 247, y: 88 }, { id: "RR", x: 281, y: 88 }, { id: "RP", x: 315, y: 88 },
  { id: "SL", x: 129, y: 133, subhole: true }, { id: "SR", x: 247, y: 133, subhole: true },
];
const BACK = [{ id: "LT", x: 120, y: 58 }, { id: "RT", x: 240, y: 58 }] as const;

function HoleStates({ fingering }: Readonly<{ fingering: OcarinaFingering }>) {
  const states = (covered: boolean) => OCARINA_HOLES.filter(({ id }) => fingering.covered[id] === covered).map(({ id }) => id).join(", ") || "none";
  return <div aria-label="Expected hole states" className="text-xs leading-relaxed text-zinc-200"><p>Cover: {states(true)}</p><p>Open: {states(false)}</p></div>;
}

/** Receives presentation context only: no capture, calibration, acceptance or recording owner. */
export function OcarinaFingeringGuide({ context }: Readonly<{ context: InstrumentPitchContext }>) {
  const id = useId();
  const expected = getOcarinaFingering(context.expected?.semitone ?? null);
  const live = getOcarinaLiveFingering(context);
  const hole = ({ id: holeId, x, y, subhole = false }: (typeof FRONT)[number]) => {
    const covered = expected?.covered[holeId];
    const label = OCARINA_HOLES.find(({ id }) => id === holeId)!.label;
    const state = covered === undefined ? "unavailable" : covered ? "cover" : "open";
    return <g key={holeId} data-ocarina-hole={holeId} data-state={state}>
      <title>{holeId}: {label} — {state}</title>
      <circle cx={x} cy={y} r={subhole ? 7 : 13} fill={covered ? "#fafafa" : "#18181b"} stroke="#fafafa" strokeWidth="2.5" strokeDasharray={covered === undefined ? "3 3" : undefined} />
      <text x={x} y={y + (subhole ? 23 : 31)} textAnchor="middle" fill="#fafafa" fontSize="15" fontWeight="bold">{holeId}</text>
    </g>;
  };
  return <aside aria-label="Ocarina fingering guide" className="ocarina-fingering-guide grid min-w-0 content-start gap-2 rounded-lg border border-sky-400/50 bg-zinc-900 p-2">
    <div><h2 className="text-lg font-bold">Ocarina fingering</h2><p className="text-xs text-zinc-300">Standard 12-hole Alto C · Provisional</p></div>
    <div aria-label="Expected ocarina fingering" data-ocarina-expected={expected?.semitone} className="min-w-0 break-words">
      <p className="text-2xl font-bold">Expected {context.expected?.label ?? "—"}</p>
      <p className="text-sm">{expected ? ocarinaFingeringInstruction(expected) : context.expected
        ? "Fingering not yet verified for this profile. Your written target is unchanged."
        : "No current target — no recommended fingering."}</p>
    </div>
    <p className="text-xs text-zinc-300">Player’s hand order: left on left in both schematic views. Subhole placement is unverified.</p>
    <svg role="img" aria-labelledby={`${id}-front-title ${id}-front-desc`} viewBox="0 0 360 180" className="w-full min-w-0 max-w-sm justify-self-center">
      <title id={`${id}-front-title`}>Front ocarina fingering: {context.expected?.label ?? "no target"}</title>
      <desc id={`${id}-front-desc`}>FRONT finger surface, player’s hand order. Eight main finger holes and two smaller labeled subholes. Filled means cover; outlined means open; dashed means unavailable. {OCARINA_HOLES.filter(({ group }) => group !== "thumb").map(({ id: holeId, label }) => `${holeId}, ${label}: ${expected ? expected.covered[holeId] ? "cover" : "open" : "unavailable"}.`).join(" ")}</desc>
      <text x="20" y="22" fill="#fafafa" fontSize="17" fontWeight="bold">FRONT</text>
      <text x="111" y="43" textAnchor="middle" fill="#fafafa" fontSize="15">Left hand</text>
      <text x="264" y="43" textAnchor="middle" fill="#fafafa" fontSize="15">Right hand</text>
      <path d="M 24 104 Q 9 73 47 60 Q 175 36 304 60 Q 346 67 341 99 L 324 153 L 299 171 L 273 151 Q 137 166 48 133 Q 30 125 24 104 Z" fill="#18181b" stroke="#a1a1aa" strokeWidth="2" />
      {FRONT.map(hole)}
    </svg>
    <svg role="img" aria-labelledby={`${id}-back-title ${id}-back-desc`} viewBox="0 0 360 105" className="w-full min-w-0 max-w-sm justify-self-center">
      <title id={`${id}-back-title`}>Back ocarina thumb holes: {context.expected?.label ?? "no target"}</title>
      <desc id={`${id}-back-desc`}>BACK underneath, same player hand order, not a mirrored photograph. LT, left thumb: {expected ? expected.covered.LT ? "cover" : "open" : "unavailable"}. RT, right thumb: {expected ? expected.covered.RT ? "cover" : "open" : "unavailable"}. No voicing hole is shown.</desc>
      <text x="20" y="20" fill="#fafafa" fontSize="17" fontWeight="bold">BACK · thumbs underneath</text>
      <path d="M 45 60 Q 35 31 100 30 L 275 30 Q 335 42 310 82 Q 167 114 60 83 Z" fill="#18181b" stroke="#a1a1aa" strokeWidth="2" />
      {BACK.map(hole)}
    </svg>
    <p className="text-xs font-semibold">● Filled = cover · ○ Outlined = open{!expected && " · Dashed = unavailable"}</p>
    {expected && <HoleStates fingering={expected} />}
    <div aria-label="Live ocarina fingering suggestion" data-ocarina-live={live.fingering?.semitone} className="rounded border border-amber-300/60 p-2 text-xs">
      <p className="font-bold">Live pitch-derived suggestion: {live.label ?? "—"}</p><p>{live.message}</p>
    </div>
    <p className="text-xs text-zinc-300">Pitch only: the microphone cannot identify your actual covered holes. Fingering guidance does not grade your playing.</p>
    <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Fingering profile and details</summary>
      <div className="grid gap-2 text-sm text-zinc-300">
        <p>{OCARINA_PROFILE.name}. {OCARINA_PROFILE.verification} This is a common transverse chart, not a verified Huazzzyi manufacturer chart.</p>
        <p>Supported concert pitches: {OCARINA_PROFILE.fingerings.map(({ note }) => note).join(", ")}. Chromatic pitches have no verified fingering here. Music is never transposed to fit this guide.</p>
        <p>The common Taiwanese layout associates subholes with the middle fingers. Other layouts differ. SL and SR are logical labels; this drawing does not reproduce the owner’s drilling pattern.</p>
        <dl className="grid grid-cols-2 gap-x-2">{OCARINA_HOLES.map(({ id: holeId, label }) => <div key={holeId}><dt className="inline font-semibold">{holeId}: </dt><dd className="inline">{label}</dd></div>)}</dl>
        <p>Breath pressure and manufacturing differences can change pitch with the same fingering. Fresh microphone pitch suggests a conventional fingering, not observed physical coverage. Accepted pitch/attack is the existing practice acknowledgment; written duration is not assessed.</p>
        <p>References supplied by the owner: common fingering system, booklet collection, and instrument listing. Confirm the owner’s actual booklet, chart and subhole layout before adding manufacturer-specific or chromatic fingerings.</p>
        <ul className="list-inside list-disc">{OCARINA_PROFILE.references.map((url, index) => <li key={url}><a className="underline" href={url} target="_blank" rel="noreferrer">{["Pure Ocarinas fingering system", "STL Ocarina booklets", "Owner’s Amazon instrument listing"][index]}</a></li>)}</ul>
      </div>
    </details>
  </aside>;
}
