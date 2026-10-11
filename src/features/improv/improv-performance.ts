import { immutableCopy, type ImprovLoadedTake } from "./improv-library";
import type { RawMidiMessage } from "@/lib/midi/midi-transport";
import type { ImprovTakeControl, ImprovTakeEvent } from "./improv-take";
import { createImprovMusicalClock, createImprovPerformanceFilter } from "./improv-musical-time";

/** A bounded rendering policy, not a change to captured timing or an estimate of performed tempo. */
export const IMPROV_PROJECTION_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
export type ImprovTimingIssue = Readonly<{ sequence: number | null; reason: string }>;
export type ImprovTimingProjection = Readonly<{
  provenance: "derived-receipt-timing";
  events: readonly Readonly<{ sequence: number; atMs: number; source: "receipt" | "unverified-browser-fallback" | "previous-position"; elapsedMs?: number; paused?: boolean; represented?: boolean }>[];
  steps?: readonly ImprovProjectionStep[];
  elapsedDurationMs?: number; pauseCount?: number;
  durationMs: number; knownEnd: boolean; issues: readonly ImprovTimingIssue[];
}>;
export type ImprovProjectionStep = Readonly<{ atMs: number; control: ImprovTakeControl }> | Readonly<{ atMs: number; event: number; paused: boolean; represented: boolean }>;

/** Shared incremental policy for live display and immutable saved review. */
export function projectImprovEventTiming(event: ImprovTakeEvent, start: number, previous: number,
  issue: (reason: string) => void = () => {}) {
  if (event.timing.sourceValidity !== "valid") issue("invalid-browser-timestamp");
  if (event.timing.sourceTimestampRegressed) issue("regressing-browser-timestamp");
  if (event.timing.receiptTimestampRegressed) issue("regressing-receipt-timestamp");
  let source: ImprovTimingProjection["events"][number]["source"] = "receipt";
  let position = event.raw.receivedAtMs - start;
  if (!Number.isFinite(event.raw.receivedAtMs) || event.raw.receivedAtMs < 0) {
    issue("invalid-receipt-timestamp"); source = "unverified-browser-fallback";
    position = event.raw.sourceTimeStampMs === null ? NaN : event.raw.sourceTimeStampMs - start;
    issue("browser-clock-unverified");
  }
  if (!Number.isFinite(position) || position < 0 || position > IMPROV_PROJECTION_LIMIT_MS) {
    issue("position-unusable-or-outside-limit"); position = previous; source = "previous-position";
  } else if (position < previous) { issue("position-held-in-delivery-order"); position = previous; }
  return { sequence: event.sequence, atMs: position, source };
}

/** Delivery order is authoritative. Invalid/regressing positions hold at the previous position. */
export function projectImprovTiming(take: ImprovLoadedTake): ImprovTimingProjection {
  const start = take.record.capture.start.observation.atMs;
  const issues: ImprovTimingIssue[] = [];
  let previous = 0;
  const musical = createImprovMusicalClock(), filter = createImprovPerformanceFilter();
  const controls = take.record.controls ?? []; let controlIndex = 0;
  const steps: ImprovProjectionStep[] = [];
  const consumeControls = (after: number) => {
    while (controlIndex < controls.length && controls[controlIndex].afterEventSequence <= after) {
      const control = controls[controlIndex++];
      const relative = control.boundary.observation.atMs - start;
      if (!Number.isFinite(relative) || relative < previous || relative > IMPROV_PROJECTION_LIMIT_MS) issues.push({ sequence: null, reason: "control-position-held-in-order" });
      else previous = relative;
      const atMs = musical.control(control, previous);
      if (control.kind === "pause") filter.pause();
      steps.push({ atMs, control });
    }
  };
  const events = take.chunks.flatMap((chunk) => chunk.events).map((event) => {
    consumeControls(event.sequence - 1);
    const issue = (reason: string) => issues.push({ sequence: event.sequence, reason });
    const projected = projectImprovEventTiming(event, start, previous, issue);
    previous = projected.atMs;
    if (take.record.schemaVersion === 2) {
      const atMs = musical.position(previous), paused = musical.paused();
      const decoded = decodeImprovMessage(event.raw);
      const represented = decoded.kind === "channel" ? filter.accept(decoded.bytes, paused) : !paused;
      steps.push({ atMs, event: event.sequence - 1, paused, represented });
      return { ...projected, atMs, elapsedMs: previous, paused, represented };
    }
    return projected;
  });
  consumeControls(take.record.committedEventWatermark);
  const terminal = take.record.capture.terminal?.boundary;
  const fullPrefix = take.record.committedEventWatermark === take.record.capture.eventWatermark
    && take.record.connections.length === take.record.capture.connectionCount
    && (take.record.committedControlWatermark ?? 0) === (take.record.capture.controlCount ?? 0);
  const end = terminal ? terminal.observation.atMs - start : NaN;
  const knownEnd = ["completed", "interrupted"].includes(take.record.status) && fullPrefix && !!terminal
    && terminal.contextMatchesStart && terminal.validity === "valid" && end >= 0 && end <= IMPROV_PROJECTION_LIMIT_MS;
  if (!knownEnd) issues.push({ sequence: null, reason: "unknown-end-use-durable-prefix" });
  if (knownEnd && previous > end) issues.push({ sequence: null, reason: "delivered-events-after-observed-end" });
  const elapsedDurationMs = knownEnd ? Math.max(previous, end) : previous;
  return immutableCopy({ provenance: "derived-receipt-timing", events,
    durationMs: take.record.schemaVersion === 2 ? musical.position(elapsedDurationMs) : elapsedDurationMs, knownEnd, issues,
    ...(take.record.schemaVersion === 2 ? { steps, elapsedDurationMs, pauseCount: controls.filter(c => c.kind === "pause").length } : {}) });
}

export type ImprovDecodedMessage = Readonly<{
  kind: "channel" | "sysex" | "unsupported" | "malformed" | "missing";
  bytes: readonly number[]; channel: number | null; command: number | null;
}>;
/** Interpretation is separate from the raw journal; no normalization of velocity-zero encodings. */
export function decodeImprovMessage(raw: Pick<RawMidiMessage, "bytes" | "dataStatus">): ImprovDecodedMessage {
  const bytes = raw.bytes ?? [];
  const result = (kind: ImprovDecodedMessage["kind"], channel: number | null = null, command: number | null = null) => ({ kind, bytes, channel, command });
  if (raw.dataStatus !== "available" || raw.bytes === null) return result("missing");
  if (!bytes.length || bytes.some((v) => !Number.isInteger(v) || v < 0 || v > 255) || bytes[0] < 128) return result("malformed");
  const status = bytes[0];
  if (status < 240) {
    const command = status & 0xf0;
    const length = command === 0xc0 || command === 0xd0 ? 2 : 3;
    if (bytes.length !== length || bytes.slice(1).some((v) => v > 127)) return result("malformed");
    return result("channel", status & 15, command);
  }
  if (status === 0xf0) {
    return result(bytes.length >= 2 && bytes.at(-1) === 0xf7 && bytes.slice(1, -1).every((v) => v < 128) ? "sysex" : "malformed");
  }
  // System common/realtime bytes aren't channel events or SMF meta events (0xff is reset here).
  return result("unsupported");
}

export function summarizeImprovTake(take: ImprovLoadedTake) {
  const timing = projectImprovTiming(take);
  const pitches: number[] = []; const velocities: number[] = []; const attackPositions: number[] = [];
  const pairs: number[] = []; const held = new Map<string, { at: number; valid: boolean; ambiguous: boolean }[]>();
  let attacks = 0; let pedalEvents = 0; let repeatedOverlappingAttacks = 0; let unmatchedReleases = 0; let keyDown = 0; let maximumKeyDownPolyphony = 0;
  const events = take.chunks.flatMap((c) => c.events);
  let controlIndex = 0;
  const controls = take.record.controls ?? [];
  let pauseCutoffAttacks = 0;
  const consumeControls = (before: number) => {
    while (controlIndex < controls.length && controls[controlIndex].afterEventSequence < before) {
      if (controls[controlIndex].kind === "pause") { pauseCutoffAttacks += keyDown; held.clear(); keyDown = 0; }
      controlIndex++;
    }
  };
  events.forEach((event, i) => {
    consumeControls(event.sequence);
    if (timing.events[i].represented === false) return;
    const decoded = decodeImprovMessage(event.raw);
    if (decoded.kind !== "channel") return;
    const [, pitch, velocity] = decoded.bytes;
    if (decoded.command === 0xb0 && pitch === 64) pedalEvents++;
    const key = `${decoded.channel}:${pitch}`;
    if (decoded.command === 0x90 && velocity > 0) {
      attacks++; pitches.push(pitch); velocities.push(velocity); attackPositions.push(timing.events[i].atMs);
      const queue = held.get(key) ?? [];
      if (queue.length) { repeatedOverlappingAttacks++; queue.forEach((n) => { n.ambiguous = true; }); }
      queue.push({ at: take.record.schemaVersion === 2 ? timing.events[i].atMs : event.raw.receivedAtMs, valid: event.timing.receiptValidity === "valid" && !event.timing.receiptTimestampRegressed, ambiguous: queue.length > 0 });
      held.set(key, queue); keyDown++; maximumKeyDownPolyphony = Math.max(maximumKeyDownPolyphony, keyDown);
    } else if (decoded.command === 0x80 || (decoded.command === 0x90 && velocity === 0)) {
      const attack = held.get(key)?.shift();
      if (!attack) { unmatchedReleases++; return; }
      keyDown--;
      const releaseAt = take.record.schemaVersion === 2 ? timing.events[i].atMs : event.raw.receivedAtMs;
      if (!attack.ambiguous && attack.valid && event.timing.receiptValidity === "valid" && !event.timing.receiptTimestampRegressed && releaseAt >= attack.at) pairs.push(releaseAt - attack.at);
    }
  });
  consumeControls(take.record.committedEventWatermark + 1);
  return immutableCopy({ provenance: "derived-descriptive-summary", observedEvents: events.length,
    observedBoundaryDurationMs: timing.knownEnd ? take.record.capture.terminal!.boundary.observation.atMs - take.record.capture.start.observation.atMs : null,
    projectedDurationMs: timing.durationMs, pauseCount: timing.pauseCount ?? 0, noteAttacks: attacks,
    lowestPitch: pitches.length ? pitches.reduce((a, b) => Math.min(a, b)) : null, highestPitch: pitches.length ? pitches.reduce((a, b) => Math.max(a, b)) : null,
    velocity: { minimum: velocities.length ? velocities.reduce((a, b) => Math.min(a, b)) : null, maximum: velocities.length ? velocities.reduce((a, b) => Math.max(a, b)) : null,
      mean: velocities.length ? velocities.reduce((a, b) => a + b, 0) / velocities.length : null },
    pedalEvents, repeatedOverlappingAttacks, maximumKeyDownPolyphony, unmatchedReleases, unreleasedAttacks: keyDown, pauseCutoffAttacks,
    unambiguousReceiptPairedDurationsMs: pairs,
    projectedInterAttackGapsMs: attackPositions.slice(1).map((at, i) => at - attackPositions[i]), timingIssues: timing.issues });
}
