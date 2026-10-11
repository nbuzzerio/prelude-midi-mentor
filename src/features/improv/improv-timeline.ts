import { decodeImprovMessage, IMPROV_PROJECTION_LIMIT_MS, projectImprovEventTiming, projectImprovTiming } from "./improv-performance";
import type { ImprovLoadedTake } from "./improv-library";
import type { ImprovTakeEvent, ImprovTakeMetadata } from "./improv-take";
import { spellFreeplayMidiNumber, type FreeplayNotationContext } from "@/features/freeplay/freeplay-notation";

export const IMPROV_WINDOW_MS = 12_000;
export const IMPROV_VISIBLE_NOTES = 512;
export const IMPROV_LIVE_NOTES = 4096;
export type TimelineNote = Readonly<{ sequence: number; pitch: number; channel: number; onsetMs: number; releaseMs: number | null }>;
type MutableNote = { -readonly [K in keyof TimelineNote]: TimelineNote[K] };
type PairQueue = { notes: MutableNote[]; omitted: number };

export function timelineWindow(atMs: number, windowMs = IMPROV_WINDOW_MS) {
  const leftMs = Math.max(0, atMs - windowMs * .8);
  return { leftMs, rightMs: leftMs + windowMs };
}
function safePosition(value: number, fallback: number) {
  return Number.isFinite(value) && value >= 0 && value <= IMPROV_PROJECTION_LIMIT_MS ? Math.max(value, fallback) : fallback;
}

/** Display only. Live storage is bounded; saved review indexes the existing bounded immutable take once. */
export function createImprovTimeline(startMs: number, archive = false) {
  const notes: MutableNote[] = [];
  const held = new Map<string, PairQueue>(); const pedal = new Set<number>();
  let previous = 0; let lastSequence = 0; let endMs: number | null = null; let knownEnd = false;
  let lastElapsed = 0;
  let issueCount = 0; let omitted = 0; let unmatchedReleases = 0;
  let tree: Float64Array | null = null;
  const keyOf = (note: TimelineNote) => `${note.channel}:${note.pitch}`;
  const evict = (note: MutableNote) => {
    if (note.releaseMs === null) {
      const queue = held.get(keyOf(note))!;
      queue.notes.shift(); queue.omitted++; // Keep FIFO release counts even for omitted display detail.
    }
  };
  const elapsed = (now: number) => endMs ?? (lastElapsed = safePosition(now - startMs, Math.max(previous, lastElapsed)));
  function prune(left: number) {
    if (archive) return;
    // Closed intervals behind the live window need no retained display objects.
    for (let i = notes.length - 1; i >= 0; i--) {
      if (notes[i].releaseMs !== null && notes[i].releaseMs! < left) notes.splice(i, 1);
    }
  }
  function buildTree() {
    tree = new Float64Array(Math.max(1, notes.length * 4));
    const build = (node: number, lo: number, hi: number): number => {
      if (hi - lo === 1) return tree![node] = notes[lo].releaseMs ?? endMs ?? previous;
      const mid = (lo + hi) >>> 1;
      return tree![node] = Math.max(build(node * 2, lo, mid), build(node * 2 + 1, mid, hi));
    };
    if (notes.length) build(1, 0, notes.length);
  }
  const model = {
    elapsed,
    append(event: ImprovTakeEvent) {
      if (endMs !== null || event.sequence <= lastSequence) return;
      lastSequence = event.sequence;
      previous = projectImprovEventTiming(event, startMs, previous, () => issueCount++).atMs;
      const decoded = decodeImprovMessage(event.raw);
      if (decoded.kind !== "channel") return;
      const [, pitch, velocity] = decoded.bytes; const channel = decoded.channel!;
      if (decoded.command === 0xb0 && pitch === 64) { if (velocity >= 64) pedal.add(channel); else pedal.delete(channel); return; }
      const key = `${channel}:${pitch}`;
      if (decoded.command === 0x90 && velocity > 0) {
        const note: MutableNote = { sequence: event.sequence, pitch, channel, onsetMs: previous, releaseMs: null };
        const queue = held.get(key) ?? { notes: [], omitted: 0 };
        queue.notes.push(note); held.set(key, queue); notes.push(note);
        if (!archive && notes.length > IMPROV_LIVE_NOTES) { evict(notes.shift()!); omitted++; }
      } else if (decoded.command === 0x80 || (decoded.command === 0x90 && velocity === 0)) {
        const queue = held.get(key);
        if (queue?.omitted) queue.omitted--;
        else if (queue?.notes.length) queue.notes.shift()!.releaseMs = previous;
        else unmatchedReleases++;
        if (queue && !queue.notes.length && !queue.omitted) held.delete(key);
      }
    },
    finish(durationMs: number, known: boolean) {
      if (endMs !== null) return;
      endMs = safePosition(durationMs, previous); knownEnd = known;
      if (archive) buildTree();
    },
    finishCapture(metadata: ImprovTakeMetadata) {
      if (!metadata.terminal) return;
      const boundary = metadata.terminal.boundary; const end = boundary.observation.atMs - startMs;
      const known = boundary.contextMatchesStart && boundary.validity === "valid" && end >= 0 && end <= IMPROV_PROJECTION_LIMIT_MS;
      model.finish(known ? end : previous, known);
    },
    view(now: number, requestedLeft?: number, windowMs = IMPROV_WINDOW_MS) {
      const atMs = elapsed(now); const leftMs = requestedLeft ?? timelineWindow(atMs, windowMs).leftMs;
      const rightMs = leftMs + windowMs;
      prune(Math.min(leftMs, timelineWindow(atMs).leftMs)); // Resizing back to 12 seconds retains recent context.
      const visible: TimelineNote[] = []; let crowded = false;
      const visit = (note: MutableNote) => {
        if (note.onsetMs <= rightMs && (note.releaseMs ?? atMs) >= leftMs) {
          if (visible.length < IMPROV_VISIBLE_NOTES) visible.push({ ...note }); else crowded = true;
        }
      };
      if (tree && notes.length) {
        const query = (node: number, lo: number, hi: number) => {
          if (crowded || tree![node] < leftMs || notes[lo].onsetMs > rightMs) return;
          if (hi - lo === 1) { visit(notes[lo]); return; }
          const mid = (lo + hi) >>> 1; query(node * 2 + 1, mid, hi); query(node * 2, lo, mid);
        };
        query(1, 0, notes.length);
      } else for (let i = notes.length - 1; i >= 0; i--) { visit(notes[i]); if (crowded) break; }
      // Prefer recent attacks at the detail cap, then retain their original delivery order.
      return { notes: visible.reverse(), atMs, leftMs, rightMs, recording: endMs === null, knownEnd,
        pedalActive: pedal.size > 0, issueCount, crowded, omitted, unmatchedReleases, retainedNotes: notes.length, version: lastSequence };
    },
  };
  return model;
}
export type ImprovTimeline = ReturnType<typeof createImprovTimeline>;

export function timelineFromTake(take: ImprovLoadedTake) {
  const model = createImprovTimeline(take.record.capture.start.observation.atMs, true);
  for (const chunk of take.chunks) for (const event of chunk.events) model.append(event);
  const timing = projectImprovTiming(take);
  model.finish(timing.durationMs, timing.knownEnd);
  return model;
}

/** Written diatonic position; octave displacement preserves the actual name, never clips pitch. */
export function timelinePitch(pitch: number, context: FreeplayNotationContext) {
  const note = spellFreeplayMidiNumber({ context, midiNumber: pitch });
  if (!note) return null;
  const letter = "CDEFGAB".indexOf(note.name[0]);
  let step = note.octave * 7 + letter; let displacement = 0;
  while (step < 14) { step += 7; displacement--; }
  while (step > 42) { step -= 7; displacement++; }
  const treble = step >= 28;
  const bottom = treble ? 138 : 258; const bottomStep = treble ? 30 : 18;
  const y = bottom - (step - bottomStep) * 6;
  const ledgers: number[] = [];
  for (let line = bottom + 12; line <= y; line += 12) ledgers.push(line);
  for (let line = bottom - 60; line >= y; line -= 12) ledgers.push(line);
  return { y, treble, ledgers, name: `${note.name}${note.octave}`, accidental: note.name.slice(1), displacement };
}
