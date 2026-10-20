import { assessContinuous } from "./continuous-assessment";
import { projectContinuousPassage } from "./continuous-projection";
import type { ContinuousAttempt, ContinuousStore } from "./continuous-types";

export const CONTINUOUS_DB = "prelude-continuous-piece-v1";
export const CONTINUOUS_RETENTION = 64;
export const CONTINUOUS_MAX_ATTACKS = 2048;
export const CONTINUOUS_MAX_RECORD_BYTES = 768 * 1024;

/** Fail closed: unrecognized/corrupt records are preserved, never silently replaced. */
export function validateContinuousAttempt(value: ContinuousAttempt): void {
  if (!value || value.version !== 1 || typeof value.id !== "string" || !value.id || value.id.length > 100
    || !Number.isInteger(value.revision) || value.revision < 0
    || !["started", "completed", "stopped", "failed", "interrupted"].includes(value.status)
    || !Number.isFinite(Date.parse(value.startedAt))
    || (value.endedAt !== null && !Number.isFinite(Date.parse(value.endedAt)))
    || (value.performanceStartedAt !== null && !Number.isFinite(Date.parse(value.performanceStartedAt)))
    || !Number.isFinite(value.observedThroughMs) || value.observedThroughMs < 0
    || !Number.isInteger(value.terminalSaveAttempts) || value.terminalSaveAttempts < 0
    || !value.input || typeof value.input.id !== "string" || !value.input.id
    || !(value.input.name === null || typeof value.input.name === "string")
    || !(value.reason === null || typeof value.reason === "string")
    || !Array.isArray(value.attacks) || value.attacks.length > CONTINUOUS_MAX_ATTACKS
    || new Set(value.attacks.map((a) => a.id)).size !== value.attacks.length) throw Error("Invalid continuous attempt record.");
  const p = value.passage;
  const reconstructed = projectContinuousPassage(p.score, p.start, p.end, p.bpm, p.policy);
  if (JSON.stringify(reconstructed) !== JSON.stringify(p)) throw Error("Frozen passage provenance is inconsistent.");
  if (value.observedThroughMs > p.durationMs + p.tailMs + 1) throw Error("Invalid observation boundary.");
  for (const a of value.attacks) {
    if (!Number.isInteger(a.id) || a.id < 1 || !Number.isInteger(a.midi) || a.midi < 0 || a.midi > 127
      || !Number.isInteger(a.channel) || a.channel < 0 || a.channel > 15
      || !Number.isInteger(a.velocity) || a.velocity < 1 || a.velocity > 127
      || !Number.isFinite(a.timeMs) || a.timeMs < 0 || a.timeMs > p.durationMs + p.tailMs
      || !Number.isFinite(a.receivedAtMs) || !Number.isFinite(a.audioTimeSeconds)
      || !(a.sourceTimeStampMs === null || Number.isFinite(a.sourceTimeStampMs))
      || !(a.uncertaintyMs === null || (Number.isFinite(a.uncertaintyMs) && a.uncertaintyMs >= 0))
      || a.source !== "physical-midi" || a.input.id !== value.input.id) throw Error("Invalid physical MIDI evidence.");
  }
  const terminal = value.status !== "started";
  if (terminal !== (value.endedAt !== null) || terminal !== (value.assessment !== null)
    || (terminal && value.terminalSaveAttempts < 1)
    || (value.status === "completed" && (value.performanceStartedAt === null || value.observedThroughMs < p.durationMs + p.tailMs))) {
    throw Error("Inconsistent continuous lifecycle evidence.");
  }
  if (terminal && JSON.stringify(assessContinuous(p, value.attacks, value.observedThroughMs)) !== JSON.stringify(value.assessment)) {
    throw Error("Continuous associations do not agree with recorded evidence.");
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > CONTINUOUS_MAX_RECORD_BYTES) throw Error("Continuous attempt exceeds its record limit.");
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(Error("Local attempt storage is unavailable.")); return; }
    const request = indexedDB.open(CONTINUOUS_DB, 1);
    let abandoned = false;
    request.onupgradeneeded = () => request.result.createObjectStore("attempts", { keyPath: "id" }).createIndex("startedAt", "startedAt");
    request.onsuccess = () => { if (abandoned) request.result.close(); else resolve(request.result); };
    request.onerror = () => reject(request.error ?? Error("Cannot open continuous storage."));
    request.onblocked = () => { abandoned = true; reject(Error("Close other Prelude tabs to open continuous storage.")); };
  });
}

export function validateContinuousReplacement(previous: ContinuousAttempt, next: ContinuousAttempt): void {
  if (previous.id !== next.id || previous.revision > next.revision
    || (previous.status !== "started" && next.status === "started")
    || (previous.revision === next.revision && JSON.stringify(previous) !== JSON.stringify(next))) {
    throw Error("A newer or different acknowledgement already exists for this attempt.");
  }
  if (JSON.stringify(previous.passage) !== JSON.stringify(next.passage) || previous.startedAt !== next.startedAt
    || JSON.stringify(previous.input) !== JSON.stringify(next.input)) throw Error("Attempt identity, input and music cannot change.");
  if (previous.status !== "started") {
    const evidence = (r: ContinuousAttempt) => JSON.stringify({ ...r, revision: 0, terminalSaveAttempts: 0 });
    if (evidence(previous) !== evidence(next) || next.terminalSaveAttempts < previous.terminalSaveAttempts) {
      throw Error("Terminal evidence cannot change when retrying a save.");
    }
  }
}

export const continuousStore: ContinuousStore = {
  async save(attempt) {
    validateContinuousAttempt(attempt);
    const db = await open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("attempts", "readwrite");
        const store = tx.objectStore("attempts");
        let failure: Error | null = null;
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(failure ?? tx.error ?? Error("Attempt write failed."));
        const read = store.get(attempt.id);
        read.onsuccess = () => {
          try {
            const previous = read.result as ContinuousAttempt | undefined;
            if (previous) validateContinuousAttempt(previous);
            if (previous) validateContinuousReplacement(previous, attempt);
            store.put(attempt);
            const count = store.count();
            count.onsuccess = () => {
              let excess = count.result - CONTINUOUS_RETENTION;
              if (excess <= 0) return;
              // Inspect old records only at capacity, rather than cloning the whole ledger each checkpoint.
              const cursor = store.index("startedAt").openCursor();
              cursor.onsuccess = () => {
                if (excess <= 0) return;
                const current = cursor.result;
                if (!current) { failure = Error("Continuous history is full of recent unfinished attempts."); tx.abort(); return; }
                const record = current.value as ContinuousAttempt;
                try { validateContinuousAttempt(record); }
                catch { failure = Error("Earlier continuous evidence is invalid and has been preserved."); tx.abort(); return; }
                if (record.id !== attempt.id && (record.status !== "started" || Date.now() - Date.parse(record.startedAt) > 86400000)) {
                  current.delete(); excess--;
                }
                if (excess > 0) current.continue();
              };
            };
          } catch (error) { failure = error instanceof Error ? error : Error("Invalid history."); tx.abort(); }
        };
      });
    } finally { db.close(); }
  },
  async list() {
    const db = await open();
    try {
      return await new Promise<ContinuousAttempt[]>((resolve, reject) => {
        const tx = db.transaction("attempts", "readonly");
        const read = tx.objectStore("attempts").getAll();
        tx.oncomplete = () => {
          try { const records = read.result as ContinuousAttempt[]; records.forEach(validateContinuousAttempt); resolve(records.sort((a, b) => b.startedAt.localeCompare(a.startedAt))); }
          catch (error) { reject(error); }
        };
        tx.onabort = tx.onerror = () => reject(tx.error ?? Error("Cannot read continuous history."));
      });
    } finally { db.close(); }
  },
};
