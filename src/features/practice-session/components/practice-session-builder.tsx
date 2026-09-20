import { useMemo, useReducer, useState } from "react";
import {
  addPracticeSessionPreset, createPracticeSessionPreset, EMPTY_PRACTICE_SESSION_LIBRARY,
  loadPracticeSessionLibrary, savePracticeSessionLibrary, setLastUsedPracticeSessionPreset, type PracticeSessionStorage,
} from "../practice-session-library";
import { createPracticeSessionRunSnapshot, practiceSessionRunReducer } from "../practice-session-runtime";
import type { PracticeSessionIdFactory, PracticeSessionLibrary, PracticeSessionPreset } from "../practice-session-types";
import { PracticeSessionRuntime, PracticeSessionSummary } from "./practice-session-runtime";
import PracticeSessionPresetEditor from "./practice-session-preset-editor";

const unavailableStorage: PracticeSessionStorage = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); } };
const browserStorage = () => { try { return window.localStorage; } catch { return unavailableStorage; } };
const defaultCreateId: PracticeSessionIdFactory = () => crypto.randomUUID();

type LoadBlock = Readonly<{ reason: "unavailable" | "corrupt" | "unsupported"; message: string }>;

export default function PracticeSessionBuilder({ active = true, storage = browserStorage(), createId = defaultCreateId, createRunId = defaultCreateId, createExerciseToken = defaultCreateId, now = Date.now }: Readonly<{ active?: boolean; storage?: PracticeSessionStorage; createId?: PracticeSessionIdFactory; createRunId?: () => string; createExerciseToken?: () => string; now?: () => number }>) {
  const initial = useMemo(() => loadPracticeSessionLibrary(storage), [storage]);
  const [workingLibrary, setWorkingLibrary] = useState<PracticeSessionLibrary>(initial.ok ? initial.value : EMPTY_PRACTICE_SESSION_LIBRARY);
  const [savedLibrary, setSavedLibrary] = useState<PracticeSessionLibrary | null>(initial.ok ? initial.value : null);
  const [loadBlock, setLoadBlock] = useState<LoadBlock | null>(initial.ok ? null : initial);
  const [replacementAuthorized, setReplacementAuthorized] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(initial.ok ? initial.value.presets[0]?.id ?? null : null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [run, dispatchRun] = useReducer(practiceSessionRunReducer, null);
  const dirty = savedLibrary === null ? replacementAuthorized : JSON.stringify(workingLibrary) !== JSON.stringify(savedLibrary);
  const retry = () => {
    const result = loadPracticeSessionLibrary(storage);
    if (result.ok) { setWorkingLibrary(result.value); setSavedLibrary(result.value); setLoadBlock(null); setReplacementAuthorized(false); setSelectedPresetId(result.value.presets[0]?.id ?? null); setStatus(""); }
    else setLoadBlock(result);
  };
  const startFresh = () => {
    if (!window.confirm("Start a new Practice Session library? Your existing stored data will be replaced only when you choose Save.")) return;
    setWorkingLibrary({ schemaVersion: 1, presets: [], lastUsedPresetId: null }); setSavedLibrary(null); setLoadBlock(null); setReplacementAuthorized(true); setSelectedPresetId(null); setSelectedExerciseId(null); setStatus("Existing stored data is unchanged until you save.");
  };
  const save = () => {
    const result = savePracticeSessionLibrary(storage, workingLibrary);
    if (result.ok) { setSavedLibrary(workingLibrary); setReplacementAuthorized(false); setStatus("Practice Sessions saved."); }
    else setStatus(`${result.message} Your unsaved changes remain in this tab.`);
  };
  const createPreset = () => {
    const preset = createPracticeSessionPreset("New Practice Session", createId);
    if (!preset.ok) return;
    const result = addPracticeSessionPreset(workingLibrary, preset.value);
    if (result.ok) { setWorkingLibrary(result.value); setSelectedPresetId(preset.value.id); setSelectedExerciseId(null); setStatus("Created a new preset. Save when you are ready."); }
  };
  const startPractice = (preset: PracticeSessionPreset) => {
    const cleanBeforeStart = savedLibrary !== null && JSON.stringify(workingLibrary) === JSON.stringify(savedLibrary);
    const updated = setLastUsedPracticeSessionPreset(workingLibrary, preset.id);
    if (!updated.ok) return;
    const nextWorkingLibrary = updated.value;
    setWorkingLibrary(nextWorkingLibrary);
    if (cleanBeforeStart) {
      const result = savePracticeSessionLibrary(storage, nextWorkingLibrary);
      if (result.ok) {
        setSavedLibrary(nextWorkingLibrary);
        setStatus("");
      } else {
        setStatus("Practice started, but the last-used preference could not be saved. Your changes remain in this tab.");
      }
    }
    dispatchRun({ type: "START_RUN", runId: createRunId(), startedAt: now(), firstExerciseToken: createExerciseToken(), snapshot: createPracticeSessionRunSnapshot(preset), foreground: document.visibilityState !== "hidden" });
  };
  if (run?.status === "active") return <><PracticeSessionRuntime createExerciseToken={createExerciseToken} dispatch={dispatchRun} now={now} run={run} />{active && status && <p aria-live="polite" className="mx-auto mt-4 w-full max-w-7xl text-sm text-zinc-300" role="status">{status}</p>}</>;
  if (run?.status === "summary") return <PracticeSessionSummary onBack={() => dispatchRun({ type: "CLEAR_RUN" })} run={run} />;
  return <section aria-labelledby="practice-sessions-title" className="mx-auto w-full max-w-7xl text-white">
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mr-auto"><h1 className="text-2xl font-bold" id="practice-sessions-title">Practice Sessions</h1><p className="mt-1 text-sm text-zinc-400">Build and save practice-session presets.</p></div>
      {!loadBlock && <><span className={dirty ? "text-amber-300" : "text-emerald-300"}>{dirty ? "Unsaved changes" : "Saved"}</span><button className="min-h-11 rounded bg-sky-500 px-4 font-semibold disabled:opacity-40" disabled={!dirty} onClick={save} type="button">Save</button><button className="min-h-11 rounded bg-zinc-800 px-4" onClick={createPreset} type="button">New Preset</button></>}
    </div>
    {loadBlock ? <section aria-label="Practice Session storage problem" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5"><h2 className="font-semibold">Saved Practice Session data could not be loaded.</h2><p className="mt-2">{loadBlock.message} Your stored data has not been changed.</p><div className="mt-4 flex gap-2"><button className="min-h-11 rounded bg-zinc-800 px-4" onClick={retry} type="button">Retry</button>{loadBlock.reason !== "unavailable" && <button className="min-h-11 rounded border border-red-400/40 px-4 text-red-100" onClick={startFresh} type="button">Start Fresh</button>}</div></section> : <PracticeSessionPresetEditor announce={(message) => { if (active) setStatus(message); }} createId={createId} library={workingLibrary} onLibraryChange={setWorkingLibrary} onSelectExercise={setSelectedExerciseId} onSelectPreset={setSelectedPresetId} onStartPractice={startPractice} selectedExerciseId={selectedExerciseId} selectedPresetId={selectedPresetId} />}
    {active && status && <p aria-live="polite" className="mt-4 text-sm text-zinc-300" role="status">{status}</p>}
  </section>;
}
