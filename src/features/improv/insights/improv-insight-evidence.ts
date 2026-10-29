import type { ImprovLoadedTake } from "../improv-library";
import { decodeImprovMessage, projectImprovTiming } from "../improv-performance";

export const INSIGHT_CAPS = Object.freeze({ harmony: 64, phrases: 64, rests: 64, motifs: 12, occurrencesPerMotif: 8 });
export const INSIGHT_PITCH_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"] as const;
export type InsightSpan = Readonly<{ startMs: number; endMs: number }>;
/** pitchEligible concerns nominal pitch only; pedalDown records pedal exposure anywhere in the key lifetime. */
export type InsightNote = InsightSpan & Readonly<{
  pitch: number; velocity: number; channel: number; segment: number; activitySegment: number;
  released: boolean; reliable: boolean; timingReliable: boolean; pitchEligible: boolean; inferenceEligible: boolean; pedalDown: boolean; ambiguous: boolean;
}>;
export type InsightPhrase = InsightSpan & Readonly<{ noteAttacks: number; reason: string }>;
export type ImprovInsightEvidence = Readonly<{
  notes: readonly InsightNote[];
  overview: Readonly<{
    eventCount: number; noteAttacks: number; durationMs: number; knownEnd: boolean; pauseCount: number;
    lowestPitch: number | null; highestPitch: number | null; meanVelocity: number | null;
    minimumVelocity: number | null; maximumVelocity: number | null; maximumKeyDownPolyphony: number;
    pairedNoteCount: number; meanKeyDownDurationMs: number | null; pedalEvents: number;
    unmatchedReleases: number; unreleasedAttacks: number; pauseCutoffAttacks: number;
    pitchClassDistribution: readonly Readonly<{ pitchClass: number; label: string; attacks: number }>[];
    velocityDistribution: Readonly<{ soft: number; medium: number; strong: number }>;
    rhythm: Readonly<{ pairedInterAttackCount: number; meanInterAttackMs: number | null; minimumInterAttackMs: number | null; maximumInterAttackMs: number | null }>;
    sustain: Readonly<{ initialState: "unknown"; observedPedalMessages: number; downMessages: number; upMessages: number }>;
  }>;
  phrases: readonly InsightPhrase[]; rests: readonly InsightSpan[];
  limitations: readonly string[]; truncated: readonly string[];
}>;

type MutableNote = { -readonly [K in keyof InsightNote]: InsightNote[K] };
type Queue = { notes: MutableNote[]; head: number; group: { ambiguous: boolean; pitchEligible: boolean; inferenceEligible: boolean; pedalAffected: boolean } };
type ChannelState = { bend: "unknown" | "center" | "bent"; modulationMsb: number | undefined; modulationLsb: number | undefined;
  sustain: boolean | undefined; sostenuto: boolean | undefined; hold2: boolean | undefined; unknownPitch: boolean };
// These standard controls preserve nominal note identity; patch-specific acoustic routing is unknown.
const HARMLESS_CONTROLLERS = new Set([0, 7, 10, 11, 32, 39, 42, 43, 67]);
// RPN/NRPN selection (including null selection) does not apply a parameter value.
const PARAMETER_SELECTORS = new Set([98, 99, 100, 101]);
const REST_MS = 1200;

/** Full durable journal, never the bounded staff projection. FIFO queues have O(1) release. */
export function collectImprovInsightEvidence(take: ImprovLoadedTake): ImprovInsightEvidence {
  const timing = projectImprovTiming(take), events = take.chunks.flatMap(chunk => chunk.events);
  const notes: MutableNote[] = [], held = new Map<number, Queue>();
  const groups = new Map<MutableNote, Queue["group"]>();
  const channels: ChannelState[] = Array.from({ length: 16 }, () => ({ bend: "unknown", modulationMsb: undefined, modulationLsb: undefined,
    sustain: undefined, sostenuto: undefined, hold2: undefined, unknownPitch: false }));
  const limitations = new Set<string>([
    "Initial held keys and pedal/controller state are unknown. Only observed note attacks are analyzed.",
    "Timing is derived from receipt timestamps in compressed musical time; this is not a tempo, meter, notation, or reference-score assessment.",
    "Activity, rests, durations, and polyphony describe observed key-down behavior, not pedal-sustained sound or audio.",
  ]);
  let segment = 0, activitySegment = 0, keyDown = 0, maximumKeyDownPolyphony = 0;
  let pedalEvents = 0, downMessages = 0, upMessages = 0, unmatchedReleases = 0, pauseCutoffAttacks = 0, overlaps = 0;
  let unsupported = 0, realtime = 0, excluded = 0, percussion = 0, bends = 0, otherPedalEvents = 0, resets = 0, modulationEvents = 0, expressive = 0;
  const cut = (atMs: number) => {
    pauseCutoffAttacks += keyDown;
    for (const queue of held.values()) for (let i = queue.head; i < queue.notes.length; i++) {
      queue.notes[i].endMs = atMs;
      queue.notes[i].reliable = false;
    }
    held.clear(); keyDown = 0; segment++; activitySegment++;
  };
  const invalidateHeldPitch = (channel: number | undefined) => {
    // At most 16 * 128 active FIFO groups; no scan through repeated-note queues.
    for (const [key, queue] of held) if (channel === undefined || Math.floor(key / 128) === channel) {
      queue.group.inferenceEligible = false;
      queue.group.pitchEligible = false;
    }
    // Channel-local exclusions must not split trustworthy notes on another channel.
    if (channel === undefined) segment++;
  };
  const unknownPitch = (channel?: number) => {
    if (channel === undefined) channels.forEach(state => { state.unknownPitch = true; });
    else channels[channel].unknownPitch = true;
    invalidateHeldPitch(channel);
  };
  const unreliableSequences = new Set(timing.issues.filter(issue => issue.sequence !== null
    && !["invalid-browser-timestamp", "regressing-browser-timestamp"].includes(issue.reason)).map(issue => issue.sequence));
  const startMs = take.record.capture.start.observation.atMs;
  const terminalMs = timing.knownEnd ? take.record.capture.terminal!.boundary.observation.atMs : Infinity;
  const steps = timing.steps?.length ? timing.steps : timing.events.map((event, index) => ({ atMs: event.atMs, event: index, represented: true, paused: false }));
  for (const step of steps) {
    if ("control" in step) {
      if (step.control.kind === "pause") cut(step.atMs);
      continue;
    }
    const event = events[step.event], position = timing.events[step.event];
    const decoded = decodeImprovMessage(event.raw);
    if (decoded.kind !== "channel") {
      if (decoded.kind === "unsupported" && decoded.bytes.length === 1 && [0xf8, 0xfa, 0xfb, 0xfc, 0xfe].includes(decoded.bytes[0])) { realtime++; continue; }
      unsupported++;
      unknownPitch();
      continue;
    }
    const channel = decoded.channel!, [, pitch, value] = decoded.bytes, state = channels[channel];
    if (decoded.command === 0xe0) {
      bends++;
      const bend = pitch + value * 128 === 8192 ? "center" : "bent";
      if (bend !== state.bend) {
        if (bend === "bent") invalidateHeldPitch(channel);
        state.bend = bend;
      }
      continue;
    }
    if (decoded.command === 0xb0) {
      if (PARAMETER_SELECTORS.has(pitch)) continue;
      if (HARMLESS_CONTROLLERS.has(pitch)) { expressive++; continue; }
      if (pitch === 1 || pitch === 33) {
        modulationEvents++;
        const control = pitch === 1 ? "modulationMsb" : "modulationLsb";
        if (state[control] !== value) {
          if (value > 0) invalidateHeldPitch(channel);
          state[control] = value;
        }
        continue;
      }
      if (pitch === 64 || pitch === 66 || pitch === 69) {
        const pedal = pitch === 64 ? "sustain" : pitch === 66 ? "sostenuto" : "hold2", down = value >= 64;
        if (pitch === 64) { pedalEvents++; if (down) downMessages++; else upMessages++; }
        else otherPedalEvents++;
        // Pedal can affect monophonic sounding continuity without changing the held-key pitch set.
        if (down) for (const [key, queue] of held) if (Math.floor(key / 128) === channel) queue.group.pedalAffected = true;
        state[pedal] = down;
        continue;
      }
      if (pitch === 121) {
        // Reset observed transient controls only; persistent tuning/unsupported behavior remains unknown.
        resets++; state.bend = "center"; state.modulationMsb = 0; state.modulationLsb = 0;
        state.sustain = false; state.sostenuto = false; state.hold2 = false;
        continue;
      }
    }
    if ([0xa0, 0xc0, 0xd0].includes(decoded.command!)) { expressive++; continue; }
    if (decoded.command !== 0x80 && decoded.command !== 0x90) {
      unsupported++; unknownPitch(channel);
      continue;
    }
    if (!step.represented) { excluded++; continue; }
    const key = channel * 128 + pitch;
    const reliable = position.source === "receipt" && event.timing.receiptValidity === "valid"
      && !event.timing.receiptTimestampRegressed && !unreliableSequences.has(event.sequence)
      && event.raw.receivedAtMs >= startMs && event.raw.receivedAtMs <= terminalMs;
    if (decoded.command === 0x90 && value > 0) {
      if (channel === 9) percussion++;
      let queue = held.get(key);
      if (queue && queue.head < queue.notes.length) { queue.group.ambiguous = true; overlaps++; }
      else { queue = { notes: [], head: 0, group: { ambiguous: false, pitchEligible: true, inferenceEligible: true, pedalAffected: false } }; held.set(key, queue); }
      const pitchEligible = !state.unknownPitch && state.bend !== "bent" && (state.modulationMsb ?? 0) === 0 && (state.modulationLsb ?? 0) === 0;
      const pedalDown = state.sustain === true || state.sostenuto === true || state.hold2 === true;
      const note: MutableNote = { pitch, velocity: value, channel, segment, activitySegment, startMs: step.atMs, endMs: timing.durationMs,
        released: false, reliable, timingReliable: reliable, pitchEligible, inferenceEligible: pitchEligible, pedalDown, ambiguous: false };
      queue.notes.push(note); groups.set(note, queue.group); notes.push(note);
      keyDown++; maximumKeyDownPolyphony = Math.max(maximumKeyDownPolyphony, keyDown);
    } else {
      const queue = held.get(key), note = queue?.notes[queue.head];
      if (!queue || !note) { unmatchedReleases++; segment++; continue; }
      queue.head++; keyDown--; note.endMs = step.atMs; note.released = true; note.reliable &&= reliable;
      if (queue.head === queue.notes.length) held.delete(key);
    }
  }
  const unreleasedAttacks = keyDown;
  for (const note of notes) {
    note.ambiguous = groups.get(note)!.ambiguous;
    note.reliable &&= !note.ambiguous && note.released && note.endMs > note.startMs;
    note.pitchEligible &&= groups.get(note)!.pitchEligible;
    note.pedalDown ||= groups.get(note)!.pedalAffected;
    note.inferenceEligible &&= note.reliable && groups.get(note)!.inferenceEligible;
  }
  if (overlaps) limitations.add(`${overlaps} overlapping same-channel/same-pitch attacks use FIFO pairing; their durations, harmony, and motifs are excluded as ambiguous.`);
  if (unmatchedReleases) limitations.add(`${unmatchedReleases} unmatched note releases may reflect unknown initial keys or missing attacks.`);
  if (unreleasedAttacks || pauseCutoffAttacks) limitations.add(`${unreleasedAttacks} attacks lack a final release; ${pauseCutoffAttacks} held attacks were cut off by pause boundaries. Their durations are not measured.`);
  if (unsupported) limitations.add(`${unsupported} malformed, missing, system or unmodeled controller messages (including parameter data entry/increment/decrement) leave pitch/tuning or sound behavior uncertain; affected channels retain physical MIDI statistics but are excluded from tonal, harmonic, and motif hypotheses. RPN/NRPN selection alone does not change pitch; applying parameter values is not interpreted. Bend center and controller reset do not clear this uncertainty.`);
  if (realtime) limitations.add(`${realtime} MIDI clock, transport, or active-sensing messages are ignored without changing physical note lifetimes.`);
  if (bends) limitations.add("Observed noncenter pitch bend excludes affected notes from tonal, harmonic, and motif hypotheses. Center permits new nominal-pitch notes unless independent pitch/tuning uncertainty remains; it never repairs an affected note's lifetime.");
  if (modulationEvents) limitations.add("Nonzero modulation-wheel MSB/LSB is conservatively treated as possible pitch modulation. Clearing both observed components permits new notes; affected note lifetimes remain excluded.");
  if (expressive) limitations.add("Volume, pan, expression, bank/program, pressure and soft-pedal messages preserve nominal MIDI-note evidence. Timbre and device-specific pitch routing are not rendered or verified.");
  if (resets) limitations.add("Reset All Controllers restores observed bend, modulation and pedal state for new notes; it does not establish initial tuning or undo unsupported controller behavior.");
  if (excluded) limitations.add(`${excluded} paused or pause-excluded note messages do not contribute to musical insights.`);
  if (pedalEvents || otherPedalEvents) limitations.add("Observed sustain, sostenuto and Hold 2 are tracked conservatively: notes attacked or held while a pedal is down are excluded from arpeggios and motifs, but retain nominal-pitch tonal support and held-key chord eligibility. Pedal-up permits new notes; pedal-retained sound is not reconstructed.");
  if (percussion) limitations.add(`${percussion} channel-10 attacks are included in activity statistics but excluded from tonal, harmonic, and motif hypotheses because channel 10 may be percussion.`);
  if (!timing.knownEnd) limitations.add("Only the saved durable prefix is available; the take end and trailing silence are uncertain.");
  if (take.record.status === "interrupted") limitations.add("Capture was interrupted; this analysis describes only retained evidence.");
  for (const reason of new Set(timing.issues.map(issue => issue.reason))) limitations.add(`Timing limitation: ${reason}.`);
  if (events.some(event => (event.timing.transportSequenceGap ?? 0) > 0)) limitations.add("Transport sequence gaps are observed; they do not prove that this take lost events.");

  const phrases: InsightPhrase[] = [], rests: InsightSpan[] = [], truncated: string[] = [];
  let phrase: { startMs: number; endMs: number; noteAttacks: number; reason: string } | null = null;
  let previousSegment = -1;
  const appendPhrase = () => {
    if (!phrase) return;
    if (phrases.length < INSIGHT_CAPS.phrases) phrases.push(phrase);
    else if (!truncated.includes("phrases")) truncated.push("phrases");
  };
  for (const note of notes) {
    const boundary = previousSegment !== note.activitySegment;
    const gap = phrase ? note.startMs - phrase.endMs : 0;
    if (!phrase || boundary || gap >= REST_MS) {
      if (phrase && !boundary && gap >= REST_MS) {
        if (rests.length < INSIGHT_CAPS.rests) rests.push({ startMs: phrase.endMs, endMs: note.startMs });
        else if (!truncated.includes("rests")) truncated.push("rests");
      }
      appendPhrase();
      phrase = { startMs: note.startMs, endMs: note.endMs, noteAttacks: 1,
        reason: boundary ? "Observed activity begins or resumes after a capture boundary." : "New activity after at least 1.2 seconds with no observed keys held." };
    } else { phrase.endMs = Math.max(phrase.endMs, note.endMs); phrase.noteAttacks++; }
    previousSegment = note.activitySegment;
  }
  appendPhrase();
  const reliableNotes = notes.filter(note => note.reliable);
  const sum = (values: readonly InsightNote[], project: (note: InsightNote) => number) => values.reduce((total, note) => total + project(note), 0);
  const pitchClassDistribution = INSIGHT_PITCH_NAMES.map((label, pitchClass) => ({ pitchClass, label, attacks: 0 }));
  const velocityDistribution = { soft: 0, medium: 0, strong: 0 };
  let gapCount = 0, gapSum = 0, gapMin = Infinity, gapMax = 0;
  notes.forEach((note, i) => {
    pitchClassDistribution[note.pitch % 12].attacks++;
    velocityDistribution[note.velocity <= 42 ? "soft" : note.velocity <= 84 ? "medium" : "strong"]++;
    if (i && note.segment === notes[i - 1].segment && note.timingReliable && notes[i - 1].timingReliable) {
      const gap = note.startMs - notes[i - 1].startMs;
      gapCount++; gapSum += gap; gapMin = Math.min(gapMin, gap); gapMax = Math.max(gapMax, gap);
    }
  });
  return { notes, phrases, rests, limitations: [...limitations], truncated,
    overview: { eventCount: events.length, noteAttacks: notes.length, durationMs: timing.durationMs, knownEnd: timing.knownEnd,
      pauseCount: timing.pauseCount ?? 0, lowestPitch: notes.length ? notes.reduce((p, n) => Math.min(p, n.pitch), 127) : null,
      highestPitch: notes.length ? notes.reduce((p, n) => Math.max(p, n.pitch), 0) : null,
      meanVelocity: notes.length ? sum(notes, note => note.velocity) / notes.length : null,
      minimumVelocity: notes.length ? notes.reduce((p, n) => Math.min(p, n.velocity), 127) : null,
      maximumVelocity: notes.length ? notes.reduce((p, n) => Math.max(p, n.velocity), 0) : null,
      maximumKeyDownPolyphony, pairedNoteCount: reliableNotes.length,
      meanKeyDownDurationMs: reliableNotes.length ? sum(reliableNotes, note => note.endMs - note.startMs) / reliableNotes.length : null,
      pedalEvents, unmatchedReleases, unreleasedAttacks, pauseCutoffAttacks, pitchClassDistribution, velocityDistribution,
      rhythm: { pairedInterAttackCount: gapCount, meanInterAttackMs: gapCount ? gapSum / gapCount : null,
        minimumInterAttackMs: gapCount ? gapMin : null, maximumInterAttackMs: gapCount ? gapMax : null },
      sustain: { initialState: "unknown", observedPedalMessages: pedalEvents, downMessages, upMessages } } };
}

/** Key-only monophonic runs: reject both sides of overlap, uncertain/pedal-down notes, and pauses. */
export function monophonicInsightRuns(notes: readonly InsightNote[]): readonly (readonly InsightNote[])[] {
  const runs: InsightNote[][] = []; let run: InsightNote[] = [];
  let occupiedUntil = -1, segment = -1, activitySegment = -1;
  const flush = () => { if (run.length) runs.push(run); run = []; };
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i], next = notes[i + 1];
    if (segment !== note.segment) { flush(); segment = note.segment; }
    if (activitySegment !== note.activitySegment) { occupiedUntil = -1; activitySegment = note.activitySegment; }
    const overlapsPrevious = note.startMs < occupiedUntil;
    const overlapsNext = next?.activitySegment === note.activitySegment && next.startMs < note.endMs;
    occupiedUntil = Math.max(occupiedUntil, note.endMs);
    if (!note.inferenceEligible || note.channel === 9 || note.pedalDown || overlapsPrevious || overlapsNext) { flush(); continue; }
    const previous = run.at(-1);
    if (previous && (note.startMs - previous.endMs >= REST_MS || note.channel !== previous.channel)) flush();
    run.push(note);
  }
  flush(); return runs;
}
