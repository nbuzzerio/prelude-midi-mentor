import { useState } from "react";
import EarTrainingControls from "@/features/ear-training/components/ear-training-controls";
import PracticeControls from "@/features/flashcards/components/practice-controls";
import { MelodyPracticeOptions, MelodySettingsControls } from "@/features/melody/components/melody-settings-controls";
import SequenceControls from "@/features/sequences/components/sequence-controls";
import { hasCompatibleProgressionSelection } from "@/features/sequences/sequence-config";
import type { ScalePracticeMode } from "@/features/sequences/scale-repertoire";
import type { PracticeExerciseEntry, RandomSequencePracticeExercise, ScaleRepertoirePracticeExercise } from "../practice-session-types";

function toggled<T>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value) ? values.length === 1 ? values : values.filter((item) => item !== value) : [...values, value];
}

function SequenceEditor({ entry, onChange }: Readonly<{ entry: RandomSequencePracticeExercise | ScaleRepertoirePracticeExercise; onChange: (entry: PracticeExerciseEntry) => void }>) {
  const config = entry.config;
  const changeConfig = (changes: Partial<typeof config>) => onChange({ ...entry, config: { ...config, ...changes } } as PracticeExerciseEntry);
  const changeMode = (scalePracticeMode: ScalePracticeMode) => {
    const repertoire = config.exerciseType === "scales" && scalePracticeMode !== "random";
    onChange({ ...entry, config: { ...config, scalePracticeMode }, target: repertoire ? { kind: "complete-scale-repertoire" } : entry.target.kind === "completed-sequences" ? entry.target : { kind: "completed-sequences", count: null } } as PracticeExerciseEntry);
  };
  const changeExerciseType = (exerciseType: typeof config.exerciseType) => {
    const repertoire = exerciseType === "scales" && config.scalePracticeMode !== "random";
    onChange({ ...entry, config: { ...config, exerciseType }, target: repertoire ? { kind: "complete-scale-repertoire" } : entry.target.kind === "completed-sequences" ? entry.target : { kind: "completed-sequences", count: null } } as PracticeExerciseEntry);
  };
  const toggleProgression = (field: "enabledChordProgressionKeyIds" | "enabledChordProgressionTemplateIds", value: string) => {
    const next = toggled(config[field], value as never);
    const keys = new Set(field === "enabledChordProgressionKeyIds" ? next : config.enabledChordProgressionKeyIds);
    const templates = new Set(field === "enabledChordProgressionTemplateIds" ? next : config.enabledChordProgressionTemplateIds);
    if (hasCompatibleProgressionSelection(keys as Set<never>, templates as Set<never>)) changeConfig({ [field]: next });
  };
  return <SequenceControls
    {...config}
    enabledArpeggios={new Set(config.enabledArpeggios)} enabledArpeggioDirections={new Set(config.enabledArpeggioDirections)}
    enabledChordProgressionKeyIds={new Set(config.enabledChordProgressionKeyIds)} enabledChordProgressionTemplateIds={new Set(config.enabledChordProgressionTemplateIds)}
    enabledDirections={new Set(config.enabledDirections)} enabledIntervals={new Set(config.enabledIntervals)} enabledNoteCategories={new Set(config.enabledNoteCategories)}
    enabledScaleDirections={new Set(config.enabledScaleDirections)} enabledScales={new Set(config.enabledScales)}
    onArpeggioToggle={(value) => changeConfig({ enabledArpeggios: toggled(config.enabledArpeggios, value) })}
    onArpeggioDirectionToggle={(value) => changeConfig({ enabledArpeggioDirections: toggled(config.enabledArpeggioDirections, value) })}
    onChordProgressionKeyToggle={(value) => toggleProgression("enabledChordProgressionKeyIds", value)}
    onChordProgressionTemplateToggle={(value) => toggleProgression("enabledChordProgressionTemplateIds", value)}
    onDirectionToggle={(value) => changeConfig({ enabledDirections: toggled(config.enabledDirections, value) })}
    onExerciseTypeChange={changeExerciseType} onIntervalToggle={(value) => changeConfig({ enabledIntervals: toggled(config.enabledIntervals, value) })}
    onModeChange={(mode) => changeConfig({ mode })} onNoteCategoryToggle={(value) => changeConfig({ enabledNoteCategories: toggled(config.enabledNoteCategories, value) })}
    onScaleDirectionToggle={(value) => changeConfig({ enabledScaleDirections: toggled(config.enabledScaleDirections, value) })}
    onScalePracticeModeChange={changeMode} onScaleRepertoireChange={(scaleRepertoire) => changeConfig({ scaleRepertoire })}
    onScaleToggle={(value) => changeConfig({ enabledScales: toggled(config.enabledScales, value) })} onShowTargetNameChange={(showTargetName) => changeConfig({ showTargetName })}
  />;
}

export default function PracticeSessionExerciseEditor({ entry, onChange, labelInputRef }: Readonly<{ entry: PracticeExerciseEntry; onChange: (entry: PracticeExerciseEntry) => void; labelInputRef?: React.RefObject<HTMLInputElement | null> }>) {
  const [labelText, setLabelText] = useState(entry.label);
  const [targetText, setTargetText] = useState("count" in entry.target ? entry.target.count?.toString() ?? "" : "");
  const committedTargetText = "count" in entry.target ? entry.target.count?.toString() ?? "" : "";
  const updateTarget = (text: string) => {
    setTargetText(text);
    if (!("count" in entry.target)) return;
    if (text === "") onChange({ ...entry, target: { ...entry.target, count: null } } as PracticeExerciseEntry);
    else if (/^[1-9]\d*$/.test(text)) onChange({ ...entry, target: { ...entry.target, count: Number(text) } } as PracticeExerciseEntry);
  };
  return <section aria-label={`Edit ${entry.label}`} className="mt-3 space-y-4 rounded-xl border border-sky-400/30 bg-zinc-950 p-4">
    <label className="block text-sm font-semibold">Exercise label
      <input className="mt-1 block w-full rounded border border-white/20 bg-zinc-900 p-2" ref={labelInputRef} value={labelText} onBlur={() => { if (!labelText.trim()) setLabelText(entry.label); }} onChange={(event) => { const value = event.target.value; setLabelText(value); if (value.trim()) onChange({ ...entry, label: value }); }} />
    </label>
    {entry.engine === "flashcards" && <PracticeControls
      enabledExerciseTypes={new Set(entry.config.enabledExerciseTypes)} enabledNoteCategories={new Set(entry.config.enabledNoteCategories)} enabledTriadPositions={new Set(entry.config.enabledTriadPositions)} enabledTriadQualities={new Set(entry.config.enabledTriadQualities)} mode={entry.config.mode} showTargetName={entry.config.showTargetName}
      onExerciseTypeToggle={(value) => onChange({ ...entry, config: { ...entry.config, enabledExerciseTypes: toggled(entry.config.enabledExerciseTypes, value) } })}
      onModeChange={(mode) => onChange({ ...entry, config: { ...entry.config, mode } })} onNoteCategoryToggle={(value) => onChange({ ...entry, config: { ...entry.config, enabledNoteCategories: toggled(entry.config.enabledNoteCategories, value) } })}
      onShowTargetNameChange={(showTargetName) => onChange({ ...entry, config: { ...entry.config, showTargetName } })} onTriadPositionToggle={(value) => onChange({ ...entry, config: { ...entry.config, enabledTriadPositions: toggled(entry.config.enabledTriadPositions, value) } })} onTriadQualityToggle={(value) => onChange({ ...entry, config: { ...entry.config, enabledTriadQualities: toggled(entry.config.enabledTriadQualities, value) } })}
    />}
    {entry.engine === "sequences" && <SequenceEditor entry={entry} onChange={onChange} />}
    {entry.engine === "ear-training" && <EarTrainingControls enabledDirections={new Set(entry.config.enabledDirections)} enabledIntervals={new Set(entry.config.enabledIntervals)} onDirectionToggle={(value) => onChange({ ...entry, config: { ...entry.config, enabledDirections: toggled(entry.config.enabledDirections, value) } })} onIntervalToggle={(value) => onChange({ ...entry, config: { ...entry.config, enabledIntervals: toggled(entry.config.enabledIntervals, value) } })} />}
    {entry.engine === "melody" && <MelodySettingsControls settings={entry.config} onChange={(key, value) => onChange({ ...entry, config: { ...entry.config, [key]: value } })}><MelodyPracticeOptions continuousPractice={entry.config.continuousPractice} continuousDurationMinutes={entry.config.continuousDurationMinutes} onContinuousPracticeChange={(continuousPractice) => onChange({ ...entry, config: { ...entry.config, continuousPractice } })} onDurationChange={(continuousDurationMinutes) => onChange({ ...entry, config: { ...entry.config, continuousDurationMinutes } })} /></MelodySettingsControls>}
    {"count" in entry.target ? <label className="block text-sm font-semibold">Target
      <input aria-describedby={`target-help-${entry.id}`} className="mt-1 block w-full rounded border border-white/20 bg-zinc-900 p-2" inputMode="numeric" min="1" onBlur={() => { if (targetText !== "" && !/^[1-9]\d*$/.test(targetText)) setTargetText(committedTargetText); }} onChange={(event) => updateTarget(event.target.value)} step="1" type="number" value={targetText} />
      <span className="mt-1 block text-xs text-zinc-400" id={`target-help-${entry.id}`}>Enter a whole number greater than zero. Leave blank to finish setup later.</span>
    </label> : <p className="text-sm text-zinc-300">{entry.engine === "melody" ? `Target: ${entry.config.continuousDurationMinutes} minutes of Continuous Practice.` : "Target: Complete selected repertoire once."}</p>}
  </section>;
}
