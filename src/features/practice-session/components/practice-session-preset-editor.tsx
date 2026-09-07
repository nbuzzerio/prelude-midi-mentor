import { useRef, useState } from "react";
import {
  addPracticeExercise, deletePracticeSessionPreset, duplicatePracticeExercise, duplicatePracticeSessionPreset,
  movePracticeExercise, removePracticeExercise, renamePracticeSessionPreset, updatePracticeExercise,
} from "../practice-session-library";
import { PRACTICE_SESSION_BUILDER_OPTIONS } from "../practice-session-builder-options";
import { getPracticeExerciseConfigurationSummary, getPracticeExerciseTargetSummary } from "../practice-session-presenters";
import type { PracticeExerciseEntry, PracticeSessionIdFactory, PracticeSessionLibrary, PracticeSessionPreset } from "../practice-session-types";
import { validateRunnablePracticeSessionPreset } from "../practice-session-validation";
import PracticeSessionExerciseEditor from "./practice-session-exercise-editor";

function PresetNameInput({ name, onRename }: Readonly<{ name: string; onRename: (name: string) => void }>) {
  const [text, setText] = useState(name);
  return <label className="min-w-56 flex-1 font-semibold">Preset name<input className="mt-1 block w-full rounded border border-white/20 bg-zinc-900 p-2" value={text} onBlur={() => { if (!text.trim()) setText(name); }} onChange={(event) => { setText(event.target.value); if (event.target.value.trim()) onRename(event.target.value); }} /></label>;
}

export default function PracticeSessionPresetEditor({ library, selectedPresetId, selectedExerciseId, onLibraryChange, onSelectPreset, onSelectExercise, createId, announce, onStartPractice }: Readonly<{
  library: PracticeSessionLibrary; selectedPresetId: string | null; selectedExerciseId: string | null;
  onLibraryChange: (library: PracticeSessionLibrary) => void; onSelectPreset: (id: string | null) => void; onSelectExercise: (id: string | null) => void;
  createId: PracticeSessionIdFactory; announce: (message: string) => void; onStartPractice: (preset: PracticeSessionPreset) => void;
}>) {
  const labelRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const selected = library.presets.find(({ id }) => id === selectedPresetId) ?? null;
  const apply = (result: ReturnType<typeof renamePracticeSessionPreset>) => { if (result.ok) onLibraryChange(result.value); };
  const focusLabel = () => window.setTimeout(() => labelRef.current?.focus(), 0);
  const readiness = selected ? validateRunnablePracticeSessionPreset(selected) : null;
  const issues = readiness && !readiness.ok ? readiness.issues : [];
  const selectAfterDelete = (id: string) => {
    const index = library.presets.findIndex((preset) => preset.id === id);
    const next = library.presets[index + 1] ?? library.presets[index - 1] ?? null;
    onSelectPreset(next?.id ?? null); onSelectExercise(null);
  };
  return <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
    <nav aria-label="Practice Session presets" className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="font-semibold">Saved presets</h2>
      {library.presets.length === 0 ? <p className="mt-3 text-sm text-zinc-400">No presets yet. Create one to build a practice prescription.</p> : <ul className="mt-3 space-y-2">{library.presets.map((preset) => <li key={preset.id}><button aria-current={preset.id === selectedPresetId ? "page" : undefined} className={`min-h-11 w-full rounded-lg border px-3 py-2 text-left ${preset.id === selectedPresetId ? "border-sky-400 bg-sky-400/15" : "border-white/10 bg-zinc-900"}`} onClick={() => { onSelectPreset(preset.id); onSelectExercise(null); }} type="button">{preset.name}</button></li>)}</ul>}
    </nav>
    <section aria-label="Selected preset" className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-4">
      {!selected ? <p className="text-zinc-300">Create or select a preset to begin.</p> : <>
        <div className="flex flex-wrap items-end gap-3">
          <PresetNameInput key={selected.id} name={selected.name} onRename={(name) => apply(renamePracticeSessionPreset(library, selected.id, name))} />
          <span className={readiness?.ok ? "text-emerald-300" : "text-amber-300"}>{readiness?.ok ? "Ready" : "Needs setup"}</span>
          {readiness?.ok && <button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={() => onStartPractice(selected)} type="button">Start Practice</button>}
          <button className="min-h-11 rounded bg-zinc-800 px-3" onClick={() => { const result = duplicatePracticeSessionPreset(library, selected.id, createId); if (result.ok) { const copy = result.value.presets.find((preset) => !library.presets.some(({ id }) => id === preset.id))!; onLibraryChange(result.value); onSelectPreset(copy.id); onSelectExercise(null); announce(`Duplicated ${selected.name}.`); } }} type="button">Duplicate preset</button>
          <button className="min-h-11 rounded border border-red-400/40 px-3 text-red-200" onClick={() => { if (!window.confirm(`Delete “${selected.name}” from this working library? The deletion becomes permanent when you save.`)) return; const result = deletePracticeSessionPreset(library, selected.id); if (result.ok) { selectAfterDelete(selected.id); onLibraryChange(result.value); announce(`Removed ${selected.name}.`); } }} type="button">Delete preset</button>
        </div>
        {issues.some((issue) => !issue.exerciseId) && <p className="mt-3 text-sm text-amber-200">{issues.find((issue) => !issue.exerciseId)?.message}</p>}
        <div className="mt-5"><h3 className="font-semibold">Add exercise</h3><div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{PRACTICE_SESSION_BUILDER_OPTIONS.map((option) => <button className="min-h-11 rounded-lg border border-white/10 bg-zinc-900 p-3 text-left" key={option.id} onClick={() => { const entry = option.createEntry(createId()); const result = addPracticeExercise(library, selected.id, entry); if (result.ok) { onLibraryChange(result.value); onSelectExercise(entry.id); announce(`Added ${entry.label}.`); focusLabel(); } }} type="button"><strong className="block">{option.label}</strong><span className="text-xs text-zinc-400">{option.description}</span></button>)}</div></div>
        <h3 className="mt-6 font-semibold">Exercises</h3>
        {selected.exercises.length === 0 ? <p className="mt-2 text-sm text-zinc-400">No exercises yet.</p> : <ol className="mt-3 space-y-3">{selected.exercises.map((entry, index) => {
          const entryIssues = issues.filter((issue) => issue.exerciseId === entry.id);
          const editing = selectedExerciseId === entry.id;
          const update = (replacement: PracticeExerciseEntry) => apply(updatePracticeExercise(library, selected.id, entry.id, replacement));
          return <li className="rounded-xl border border-white/10 bg-zinc-900 p-3 focus:outline-sky-400" key={entry.id} ref={(node) => { if (node) rowRefs.current.set(entry.id, node); else rowRefs.current.delete(entry.id); }} tabIndex={-1}>
            <div className="flex flex-wrap items-start gap-3"><div className="mr-auto min-w-0"><strong>{index + 1}. {entry.label}</strong><p className="text-sm text-zinc-400">{getPracticeExerciseConfigurationSummary(entry)}</p><p className="text-sm text-zinc-300">{getPracticeExerciseTargetSummary(entry)}</p>{entryIssues.map((issue) => <p className="text-sm text-amber-200" key={issue.code}>{issue.message}</p>)}</div>
              <button aria-expanded={editing} className="min-h-11 rounded bg-zinc-800 px-3" onClick={() => onSelectExercise(editing ? null : entry.id)} type="button">{editing ? "Close editor" : "Edit"}</button>
              <button aria-label={`Move ${entry.label} up`} className="min-h-11 rounded bg-zinc-800 px-3 disabled:opacity-40" disabled={index === 0} onClick={() => { apply(movePracticeExercise(library, selected.id, entry.id, index - 1)); announce(`Moved ${entry.label} up.`); window.setTimeout(() => rowRefs.current.get(entry.id)?.focus(), 0); }} type="button">Move Up</button>
              <button aria-label={`Move ${entry.label} down`} className="min-h-11 rounded bg-zinc-800 px-3 disabled:opacity-40" disabled={index === selected.exercises.length - 1} onClick={() => { apply(movePracticeExercise(library, selected.id, entry.id, index + 1)); announce(`Moved ${entry.label} down.`); window.setTimeout(() => rowRefs.current.get(entry.id)?.focus(), 0); }} type="button">Move Down</button>
              <button aria-label={`Duplicate ${entry.label}`} className="min-h-11 rounded bg-zinc-800 px-3" onClick={() => { const result = duplicatePracticeExercise(library, selected.id, entry.id, createId); if (result.ok) { const copy = result.value.presets.find(({ id }) => id === selected.id)!.exercises[index + 1]!; onLibraryChange(result.value); onSelectExercise(copy.id); announce(`Duplicated ${entry.label}.`); focusLabel(); } }} type="button">Duplicate</button>
              <button aria-label={`Remove ${entry.label}`} className="min-h-11 rounded px-3 text-red-200" onClick={() => { const focusId = selected.exercises[index + 1]?.id ?? selected.exercises[index - 1]?.id; const result = removePracticeExercise(library, selected.id, entry.id); if (result.ok) { onLibraryChange(result.value); onSelectExercise(null); announce(`Removed ${entry.label}.`); if (focusId) window.setTimeout(() => rowRefs.current.get(focusId)?.focus(), 0); } }} type="button">Remove</button>
            </div>
            {editing && <PracticeSessionExerciseEditor entry={entry} key={`${entry.id}:${entry.target.kind}`} labelInputRef={labelRef} onChange={update} />}
          </li>;
        })}</ol>}
      </>}
    </section>
  </div>;
}
