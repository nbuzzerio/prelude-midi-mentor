import { RolodexProgressPanel } from "./rolodex-progress-panel";
import { programCalendarNow } from "../../practice-session/practice-program-attempt";
import { summarizeAcknowledged } from "./rolodex-qualification";
import type { RolodexAcceptance } from "./rolodex-progress-types";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ContinuousView } from "../continuous/continuous-session";
import { AppMidiContext } from "@/components/midi/midi-context";
import MidiStatus from "@/components/midi/midi-status";
import { ContinuousPlayer } from "../continuous/continuous-workspace";
import { continuousStore } from "../continuous/continuous-store";
import type { ContinuousAttempt, ContinuousStore } from "../continuous/continuous-types";
import { playablePassage, playability } from "./rolodex-model";
import { rolodexButton, rolodexField } from "./rolodex-editor";
import { rolodexStore } from "./rolodex-store";
import type { RolodexEntry, RolodexPractice as PracticeAcknowledgement, RolodexStore } from "./rolodex-types";
import type { MidiInputInfo } from "@/lib/midi/midi-transport";

export type RolodexLessonHost = Readonly<{
  active: boolean; finished: boolean; onView: (view: ContinuousView) => void;
  onAcknowledged: (attempt: ContinuousAttempt) => void;
  onDates: (pending: number, failed: number) => void;
  onProgress?: (entry: RolodexEntry) => void;
}>;
export function RolodexPractice({ entry, store = rolodexStore, attempts = continuousStore, onExit, onGuardChange, lessonHost }: Readonly<{
  entry: RolodexEntry; store?: RolodexStore; attempts?: ContinuousStore; onExit: () => void;
  onGuardChange?: (guard: (() => boolean) | null) => void;
  lessonHost?: RolodexLessonHost;
}>) {
  const midi = useContext(AppMidiContext);
  const [inputId, setInputId] = useState("");
  const [input, setInput] = useState<MidiInputInfo | null>(() => lessonHost && midi?.status === "connected" ? midi.connectedInputs.find(i => i.id !== null) ?? null : null);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState<readonly PracticeAcknowledgement[]>([]);
  const [savedProgress, setSavedProgress] = useState<RolodexEntry | null>(null);
  const notifyProgress = lessonHost?.onProgress;
  const [notice, setNotice] = useState("");
  const [acceptance, setAcceptance] = useState<RolodexAcceptance | null>(null);
  const acceptanceRead = useRef<Promise<RolodexAcceptance | null>>(Promise.resolve(null));
  useEffect(() => {
    let active = true;
    acceptanceRead.current = store.list().then(list => list.acceptance ?? null, () => null);
    void acceptanceRead.current.then(value => { if (active) setAcceptance(value); });
    return () => { active = false; };
  }, [store]);
  const contexts = useRef(new Map<string, { calendar: ReturnType<typeof programCalendarNow>; acceptance: Promise<RolodexAcceptance | null> }>());
  const work = useRef(new Map<string, { attempt: ContinuousAttempt; acknowledgedAt: string; endLocalDate: string | null; summary?: PracticeAcknowledgement["summary"] }>());
  const observe = useCallback((view: ContinuousView) => {
    if (view.attempt && !contexts.current.has(view.attempt.id) && view.phase !== "results") {
      contexts.current.set(view.attempt.id, { calendar: programCalendarNow(Date.parse(view.attempt.startedAt)), acceptance: acceptanceRead.current });
    }
  }, []);
  const seen = useRef(new Set<string>()), inFlight = useRef(new Set<string>());
  const notifyDates = lessonHost?.onDates, notifyAcknowledged = lessonHost?.onAcknowledged;
  useEffect(() => { notifyDates?.(pending, failed.length); }, [notifyDates, pending, failed.length]);
  const retry = useCallback((practice: PracticeAcknowledgement) => {
    if (inFlight.current.has(practice.attemptId)) return;
    inFlight.current.add(practice.attemptId); setPending(n => n + 1);
    void (async () => {
      const pending = work.current.get(practice.attemptId)!;
      const context = contexts.current.get(practice.attemptId);
      if (!pending.summary) pending.summary = await summarizeAcknowledged(entry, pending.attempt, context?.calendar ?? null,
        pending.endLocalDate, context ? await context.acceptance : null, pending.acknowledgedAt);
      const saved = await store.acknowledge(entry.id, { ...practice, summary: pending.summary });
      if (saved && saved.prescriptionRevision === entry.prescriptionRevision) { setSavedProgress(saved); notifyProgress?.(saved); }
    })().then(() => {
      work.current.delete(practice.attemptId); contexts.current.delete(practice.attemptId);
      setFailed(old => old.filter(p => p.attemptId !== practice.attemptId));
      setNotice("Rolodex practice date and progress saved locally.");
    }, () => {
      setFailed(old => old.some(p => p.attemptId === practice.attemptId) ? old : [...old, practice]);
      setNotice("A1 performance is saved. The separate Rolodex practice date and progress were not saved.");
    }).finally(() => { inFlight.current.delete(practice.attemptId); setPending(n => n - 1); });
  }, [entry, store, notifyProgress]);
  const acknowledged = useCallback((attempt: ContinuousAttempt) => {
    notifyAcknowledged?.(attempt);
    if (attempt.status === "started" || !attempt.endedAt || !attempt.performanceStartedAt || seen.current.has(attempt.id)) return;
    seen.current.add(attempt.id);
    const context = contexts.current.get(attempt.id), end = programCalendarNow(Date.parse(attempt.endedAt));
    work.current.set(attempt.id, { attempt, acknowledgedAt: new Date().toISOString(), endLocalDate: context && context.calendar.timeZone === end.timeZone ? end.localDate : null });
    retry({ attemptId: attempt.id, prescriptionRevision: entry.prescriptionRevision, endedAt: attempt.endedAt,
      outcome: attempt.status, instrument: "piano", inputSource: "physical-midi", inputId: attempt.input.id });
  }, [entry.prescriptionRevision, retry, notifyAcknowledged]);
  const registerGuard = useCallback((guard: (() => boolean) | null) => {
    onGuardChange?.(guard ? () => {
      if (!guard() || pending > 0) return false;
      return !failed.length || window.confirm("A1 performances are saved. Leave without retrying the separate Rolodex practice-date update?");
    } : null);
  }, [onGuardChange, pending, failed.length]);
  const exit = () => {
    if (lessonHost) { onExit(); return; } // Native terminal save is gated by the player; date Retry stays mounted in review.
    if (pending) return;
    if (failed.length && !window.confirm("A1 performances are saved. Leave without retrying their separate Rolodex practice dates?")) return;
    onExit();
  };
  const unavailable = playability(entry);
  const [passage] = useState(() => { try { return playablePassage(entry); } catch { return null; } });
  const inputs = midi?.connectedInputs.filter(i => i.id !== null) ?? [];
  const selected = inputs.find(i => i.id === inputId) ?? (inputId === "" ? inputs[0] : undefined);
  return <section className="grid min-w-0 gap-3">
    {!lessonHost?.finished && <h1 className="text-2xl font-bold">{lessonHost ? "Optional Piano repertoire" : "Practice Rolodex"} · {entry.nickname || entry.sourceTitle}</h1>}
    {unavailable && <p role="alert">{unavailable}</p>}
    {savedProgress && <RolodexProgressPanel entry={savedProgress} acceptance={acceptance} />}
    {notice && <p role="status">{notice}</p>}
    {pending > 0 && <p role="status">Updating separate Rolodex practice date and progress…</p>}
    {failed.length > 0 && <button type="button" className={rolodexButton} disabled={pending > 0} onClick={() => failed.forEach(retry)}>Retry Rolodex Update ({failed.length})</button>}
    {!input && !lessonHost?.finished && <>
      <p>Measures {entry.start + 1}–{entry.end + 1} · {entry.bpm} quarter BPM · Piano Continuous Tempo. Music comes from the saved snapshot.</p>
      {midi && <MidiStatus deviceName={midi.deviceName} error={midi.error} status={midi.status} onConnect={() => { void midi.connectMidi(); }} />}
      <label className="grid gap-1">Physical MIDI piano<select className={rolodexField} value={selected?.id ?? ""} onChange={e => setInputId(e.target.value)}>
        {!inputs.length && <option value="">No MIDI piano connected</option>}{inputs.map(i => <option key={i.id} value={i.id!}>{i.name ?? i.id}</option>)}</select></label>
      <p>Connect a physical MIDI piano and allow MIDI access. Virtual keys and microphones cannot start this profile.</p>
      <button className={rolodexButton} type="button" disabled={Boolean(unavailable) || !selected || midi?.status !== "connected"} onClick={() => { if (selected && !playability(entry)) setInput(selected); }}>Prepare Saved Passage</button>
      <button className={rolodexButton} onClick={exit} type="button" disabled={pending > 0}>{lessonHost ? "Finish Lesson" : "Return to Rolodex"}</button>
    </>}
    {input && passage && !unavailable && !lessonHost?.finished && <ContinuousPlayer passage={passage} input={input} store={attempts} onExit={exit} onGuardChange={registerGuard} onAcknowledgedAttempt={acknowledged} onView={observe} lessonHost={lessonHost} />}
  </section>;
}
