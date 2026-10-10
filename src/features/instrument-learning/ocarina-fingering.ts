import type { InstrumentPitchContext } from "./instrument-pitch-context";

export const OCARINA_HOLES = Object.freeze(([
  { id: "LI", label: "left index", group: "left" },
  { id: "LM", label: "left middle", group: "left" },
  { id: "LR", label: "left ring", group: "left" },
  { id: "LP", label: "left pinky", group: "left" },
  { id: "RI", label: "right index", group: "right" },
  { id: "RM", label: "right middle", group: "right" },
  { id: "RR", label: "right ring", group: "right" },
  { id: "RP", label: "right pinky", group: "right" },
  { id: "LT", label: "left thumb", group: "thumb" },
  { id: "RT", label: "right thumb", group: "thumb" },
  { id: "SL", label: "left subhole", group: "subhole" },
  { id: "SR", label: "right subhole", group: "subhole" },
] as const).map((hole) => Object.freeze(hole)));
export type OcarinaHoleId = (typeof OCARINA_HOLES)[number]["id"];
export type OcarinaFingering = Readonly<{
  semitone: number;
  note: string;
  covered: Readonly<Record<OcarinaHoleId, boolean>>;
}>;

// Explicit owner-supplied common natural-note chart; no inferred cross-fingerings.
const chart: readonly (readonly [number, string, readonly OcarinaHoleId[]])[] = [
  [69, "A4", []], [71, "B4", ["SL"]], [72, "C5", ["SL", "SR"]],
  [74, "D5", ["SL", "SR", "RP"]],
  [76, "E5", ["SL", "SR", "RP", "RR"]],
  [77, "F5", ["SL", "SR", "RP", "RR", "RM"]],
  [79, "G5", ["SL", "SR", "RP", "RR", "RM", "RI"]],
  [81, "A5", ["SL", "SR", "RP", "RR", "RM", "RI", "LR"]],
  [83, "B5", ["SL", "SR", "RP", "RR", "RM", "RI", "LR", "LM"]],
  [84, "C6", ["SL", "SR", "RP", "RR", "RM", "RI", "LR", "LM", "LI"]],
  [86, "D6", ["SL", "SR", "RP", "RR", "RM", "RI", "LR", "LM", "LI", "LT"]],
  [88, "E6", ["SL", "SR", "RP", "RR", "RM", "RI", "LR", "LM", "LI", "LT", "RT"]],
  [89, "F6", ["SL", "SR", "RP", "RR", "RM", "RI", "LR", "LM", "LI", "LT", "RT", "LP"]],
];

export const OCARINA_PROFILE = Object.freeze({
  id: "standard-12-hole-alto-c-provisional",
  name: "Standard 12-hole Alto C — provisional profile",
  verification: "Manufacturer chart and physical subhole layout not verified.",
  references: Object.freeze([
    "https://pureocarinas.com/ocarina-fingering-system?prefer_lang=en",
    "https://www.stlocarina.com/pages/booklets",
    "https://www.amazon.com/dp/B0CP93BL79",
  ]),
  fingerings: Object.freeze(chart.map(([semitone, note, open]): OcarinaFingering => Object.freeze({
    semitone, note,
    covered: Object.freeze(Object.fromEntries(OCARINA_HOLES.map(({ id }) => [id, !open.includes(id)])) as Record<OcarinaHoleId, boolean>),
  }))),
});
export const OCARINA_PITCHES = Object.freeze(OCARINA_PROFILE.fingerings.map(({ semitone }) => semitone));

export function getOcarinaFingering(semitone: number | null): OcarinaFingering | null {
  return Number.isInteger(semitone) ? OCARINA_PROFILE.fingerings.find((fingering) => fingering.semitone === semitone) ?? null : null;
}

function joinWords(words: readonly string[]): string {
  return words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** All guidance is derived from the authoritative logical states, never SVG geometry. */
export function ocarinaFingeringInstruction(fingering: OcarinaFingering): string {
  const { covered } = fingering;
  if (OCARINA_HOLES.every(({ id }) => covered[id])) return "Cover every finger hole, both thumb holes and both subholes.";
  if (OCARINA_HOLES.every(({ id }) => !covered[id])) return "Lift all eight fingers and both thumbs. Leave both subholes open.";
  const instructions = (["left", "right"] as const).map((hand) => {
    const holes = OCARINA_HOLES.filter(({ group }) => group === hand);
    const open = holes.filter(({ id }) => !covered[id]).map(({ label }) => label.replace(`${hand} `, ""));
    return !open.length ? `Keep your ${hand} hand covered.` : open.length === 4 ? `Lift all four ${hand}-hand fingers.`
      : `Keep your other ${hand}-hand holes covered; lift your ${hand} ${joinWords(open)} ${open.length === 1 ? "finger" : "fingers"}.`;
  });
  instructions.push(covered.LT && covered.RT ? "Keep both thumbs covered." : !covered.LT && !covered.RT ? "Lift both thumbs."
    : `Lift your ${covered.LT ? "right" : "left"} thumb; keep your ${covered.LT ? "left" : "right"} thumb covered.`);
  instructions.push(covered.SL && covered.SR ? "Cover both subholes." : !covered.SL && !covered.SR ? "Leave both subholes open." : `Cover the ${covered.SL ? "left" : "right"} subhole; leave the other subhole open.`);
  return instructions.join(" ");
}

/** Advisory conventional fingering for a fresh detected pitch, independent of the target. */
export function getOcarinaLiveFingering(context: InstrumentPitchContext) {
  const { live } = context;
  const unavailable = (message: string) => ({ fingering: null, label: null, message });
  if (live.state !== "live" || !live.pitch) return unavailable(live.state === "stale" ? "Stale reading — no live fingering."
    : live.state === "uncertain" ? "Uncertain pitch — no live fingering." : "No current pitch — no live fingering.");
  if (!Number.isFinite(live.pitch.frequencyHz) || live.pitch.frequencyHz <= 0) return unavailable("Unsupported reading — no live fingering.");
  const fingering = getOcarinaFingering(live.pitch.semitone);
  const label = context.pitchLabels[live.pitch.semitone] ?? `MIDI ${live.pitch.semitone}`;
  return { fingering, label, message: fingering ? ocarinaFingeringInstruction(fingering)
    : "Fingering not yet verified for this profile — no live fingering." };
}
