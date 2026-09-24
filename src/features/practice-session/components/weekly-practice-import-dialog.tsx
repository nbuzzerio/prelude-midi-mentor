import { useMemo, useState, type ChangeEvent } from "react";
import type { PracticeSessionIdFactory, PracticeSessionLibrary } from "../practice-session-types";
import { applyWeeklyPracticeImport, prepareWeeklyPracticeImport, validateWeeklyPracticeImportNames, type WeeklyPracticeImportCandidate } from "../import/weekly-practice-import";
import { readWeeklyPracticeJsonFile } from "../import/weekly-practice-file";
import type { WeeklyPracticeValidationIssue } from "../import/weekly-practice-validation";
import WeeklyPracticeDialog from "./weekly-practice-dialog";

type Props = Readonly<{ library: PracticeSessionLibrary; createId: PracticeSessionIdFactory; onCancel: () => void; onImport: (library: PracticeSessionLibrary, firstPresetId: string | null, title: string) => void }>;

function IssueList({ issues }: Readonly<{ issues: readonly WeeklyPracticeValidationIssue[] }>) {
  const groups = useMemo(() => Map.groupBy(issues, (issue) => issue.day ?? "Curriculum"), [issues]);
  return <section aria-labelledby="weekly-import-errors" className="max-h-72 overflow-y-auto rounded border border-red-400/40 bg-red-950/30 p-3">
    <h3 className="font-semibold text-red-200" id="weekly-import-errors">Could not validate this weekly plan</h3>
    {[...groups].map(([group, groupIssues]) => <div className="mt-3" key={group}><h4 className="font-medium">{group}</h4><ul className="ml-5 list-disc space-y-2">{groupIssues.map((issue, index) => <li key={`${issue.path}-${index}`}><span className="font-medium">{issue.exerciseIndex === undefined ? "" : `Exercise ${issue.exerciseIndex + 1}${issue.exerciseLabel ? ` — “${issue.exerciseLabel}”` : ""}: `}{issue.field ?? issue.path}</span><br /><span>{issue.message}</span>{issue.allowedValues && <span className="block text-sm text-zinc-400">Allowed: {issue.allowedValues.join(", ")}</span>}</li>)}</ul></div>)}
  </section>;
}

export default function WeeklyPracticeImportDialog({ library, createId, onCancel, onImport }: Props) {
  const [source, setSource] = useState("");
  const [candidate, setCandidate] = useState<WeeklyPracticeImportCandidate | null>(null);
  const [issues, setIssues] = useState<readonly WeeklyPracticeValidationIssue[]>([]);
  const [message, setMessage] = useState("");
  const [names, setNames] = useState<Readonly<Record<string, string>>>({});
  const nameIssues = candidate ? validateWeeklyPracticeImportNames(library, candidate, names) : [];
  const resetResult = () => { setCandidate(null); setIssues([]); setNames({}); setMessage(""); };
  const updateSource = (value: string) => { setSource(value); resetResult(); };
  const validate = () => {
    const result = prepareWeeklyPracticeImport(source, library, createId);
    if (!result.ok) { setCandidate(null); setIssues(result.reason === "validation" ? result.issues : []); setMessage(result.reason === "id-generation" ? result.message : ""); return; }
    setCandidate(result.candidate); setIssues([]); setMessage(""); setNames(Object.fromEntries(result.candidate.names.map((entry) => [entry.presetId, entry.proposedName])));
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const result = await readWeeklyPracticeJsonFile(file);
    if (!result.ok) { resetResult(); setSource(""); setMessage(result.message); return; }
    updateSource(result.text);
  };
  const confirm = () => {
    if (!candidate) return;
    const result = applyWeeklyPracticeImport(library, candidate, names);
    if (!result.ok) { setMessage(result.reason === "invalid-name" ? "Resolve the preset-name errors before importing." : result.message); return; }
    onImport(result.library, result.firstImportedPresetId, candidate.preview.title);
  };
  return <WeeklyPracticeDialog description="Paste raw JSON or choose a .json file. Nothing is added until you confirm." footer={<>{candidate && <button className="min-h-11 rounded bg-sky-500 px-4 font-semibold disabled:opacity-40" disabled={nameIssues.length > 0} onClick={confirm} type="button">Import weekly plan</button>}<button className="min-h-11 rounded border border-zinc-600 px-4" onClick={onCancel} type="button">Cancel</button></>} onClose={onCancel} title="Import Weekly Plan">
        {!candidate ? <div className="space-y-4"><label className="block font-medium" htmlFor="weekly-import-json">Weekly Practice JSON</label><textarea aria-describedby="weekly-import-description" className="min-h-56 w-full rounded border border-zinc-600 bg-zinc-900 p-3 font-mono text-sm" id="weekly-import-json" onChange={(event) => updateSource(event.target.value)} spellCheck={false} value={source} /><div className="flex flex-wrap gap-3"><label className="min-h-11 cursor-pointer rounded border border-zinc-600 px-4 py-2.5"><span>Choose .json file</span><input accept=".json,application/json" className="sr-only" onChange={upload} type="file" /></label><button className="min-h-11 rounded bg-sky-500 px-4 font-semibold disabled:opacity-40" disabled={!source} onClick={validate} type="button">Validate and preview</button></div>{issues.length > 0 && <IssueList issues={issues} />}</div> : <section aria-label="Weekly plan preview" className="space-y-4"><div><h3 className="text-lg font-semibold">{candidate.preview.title}</h3>{candidate.preview.instructions && <p className="mt-1 text-zinc-300">{candidate.preview.instructions}</p>}</div>{candidate.preview.days.map((day) => <article className="rounded-lg border border-white/10 bg-white/5 p-4" key={day.day}><h4 className="font-semibold">{day.day}</h4>{day.kind === "rest" ? <><p className="text-zinc-300">Rest day</p>{day.notes && <p className="mt-1 text-sm text-zinc-400">{day.notes}</p>}</> : <><label className="mt-3 block text-sm font-medium" htmlFor={`import-name-${day.presetId}`}>Resulting preset name</label><input aria-describedby={`import-name-error-${day.presetId}`} className="mt-1 min-h-11 w-full rounded border border-zinc-600 bg-zinc-900 px-3" id={`import-name-${day.presetId}`} onChange={(event) => setNames((current) => ({ ...current, [day.presetId]: event.target.value }))} value={names[day.presetId] ?? day.proposedName} />{nameIssues.find((issue) => issue.presetId === day.presetId) && <p className="mt-1 text-sm text-red-300" id={`import-name-error-${day.presetId}`}>{nameIssues.find((issue) => issue.presetId === day.presetId)!.message}</p>}{day.estimatedDurationMinutes && <p className="mt-2 text-sm">Estimated duration: {day.estimatedDurationMinutes} minutes</p>}{day.notes && <p className="mt-1 text-sm text-zinc-400">{day.notes}</p>}<ol className="mt-3 space-y-3">{day.exercises.map((exercise, index) => <li key={`${exercise.label}-${index}`}><p className="font-medium">{index + 1}. {exercise.label} <span className="font-normal text-zinc-400">({exercise.conceptName})</span></p><p className="text-sm text-zinc-300">{exercise.configurationSummary}</p><p className="text-sm text-zinc-400">Target: {exercise.targetSummary}</p></li>)}</ol></>}</article>)}<button className="min-h-11 rounded border border-zinc-600 px-4" onClick={() => setCandidate(null)} type="button">Back to JSON</button></section>}
        {message && <p className="mt-4 text-red-300" role="alert">{message}</p>}
  </WeeklyPracticeDialog>;
}
