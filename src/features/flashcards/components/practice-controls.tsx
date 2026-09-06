import type {
  PracticeClefMode,
  PracticeExerciseType,
  PracticeNoteCategory,
  PracticeTriadPosition,
  PracticeTriadQuality,
} from "@/types/practice";

type PracticeControlsProps = Readonly<{
  enabledExerciseTypes: ReadonlySet<PracticeExerciseType>;
  enabledNoteCategories: ReadonlySet<PracticeNoteCategory>;
  enabledTriadPositions: ReadonlySet<PracticeTriadPosition>;
  enabledTriadQualities: ReadonlySet<PracticeTriadQuality>;
  mode: PracticeClefMode;
  showTargetName: boolean;
  onExerciseTypeToggle: (exerciseType: PracticeExerciseType) => void;
  onModeChange: (mode: PracticeClefMode) => void;
  onNoteCategoryToggle: (category: PracticeNoteCategory) => void;
  onReset?: () => void;
  onShowTargetNameChange: (showTargetName: boolean) => void;
  onTriadPositionToggle: (position: PracticeTriadPosition) => void;
  onTriadQualityToggle: (quality: PracticeTriadQuality) => void;
}>;

const MODES: ReadonlyArray<{
  label: string;
  value: PracticeClefMode;
}> = [
  { label: "Bass", value: "bass" },
  { label: "Treble", value: "treble" },
  { label: "Mixed", value: "mixed" },
];

const NOTE_CATEGORIES: ReadonlyArray<{
  label: string;
  value: PracticeNoteCategory;
}> = [
  { label: "Naturals", value: "naturals" },
  { label: "Accidentals", value: "accidentals" },
];

const TRIAD_QUALITIES: ReadonlyArray<{
  label: string;
  value: PracticeTriadQuality;
}> = [
  { label: "Major", value: "major" },
  { label: "Minor", value: "minor" },
  { label: "Diminished", value: "diminished" },
  { label: "Augmented", value: "augmented" },
];

const TRIAD_POSITIONS: ReadonlyArray<{
  label: string;
  value: PracticeTriadPosition;
}> = [
  { label: "Root position", value: "root" },
  { label: "First inversion", value: "first" },
  { label: "Second inversion", value: "second" },
];

type ToggleButtonProps = Readonly<{
  enabled: boolean;
  label: string;
  onClick: () => void;
}>;

function ToggleButton({ enabled, label, onClick }: ToggleButtonProps) {
  return (
    <button
      aria-pressed={enabled}
      className={
        enabled
          ? "rounded-lg border border-sky-400/60 bg-sky-400/15 px-3 py-2 text-sm font-semibold text-sky-100"
          : "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white"
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

export default function PracticeControls({
  enabledExerciseTypes,
  enabledNoteCategories,
  enabledTriadPositions,
  enabledTriadQualities,
  mode,
  showTargetName,
  onExerciseTypeToggle,
  onModeChange,
  onNoteCategoryToggle,
  onReset,
  onShowTargetNameChange,
  onTriadPositionToggle,
  onTriadQualityToggle,
}: PracticeControlsProps) {
  const individualNotesEnabled = enabledExerciseTypes.has("notes");
  const triadsEnabled = enabledExerciseTypes.has("triads");

  return (
    <section
      aria-label="Practice settings"
      className="rounded-xl border border-white/10 bg-white/5 p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white">Practice settings</h2>

          <p className="mt-1 text-sm text-white/50">
            Configure flashcard practice.
          </p>
        </div>

        {onReset && <button
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
          onClick={onReset}
          type="button"
        >
          Reset session
        </button>}
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Exercises
        </legend>

        <div className="mt-2 flex flex-wrap gap-2">
          <ToggleButton
            enabled={individualNotesEnabled}
            label="Individual Notes"
            onClick={() => onExerciseTypeToggle("notes")}
          />

          <ToggleButton
            enabled={triadsEnabled}
            label="Triads"
            onClick={() => onExerciseTypeToggle("triads")}
          />
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Clef
        </legend>

        <div className="mt-2 flex flex-wrap gap-2">
          {MODES.map((option) => (
            <ToggleButton
              enabled={mode === option.value}
              key={option.value}
              label={option.label}
              onClick={() => onModeChange(option.value)}
            />
          ))}
        </div>
      </fieldset>

      {individualNotesEnabled ? (
        <fieldset className="mt-5">
          <legend className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Starting Notes
          </legend>

          <div className="mt-2 flex flex-wrap gap-2">
            {NOTE_CATEGORIES.map((option) => (
              <ToggleButton
                enabled={enabledNoteCategories.has(option.value)}
                key={option.value}
                label={option.label}
                onClick={() => onNoteCategoryToggle(option.value)}
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      {triadsEnabled ? (
        <>
          <fieldset className="mt-5">
            <legend className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Qualities
            </legend>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {TRIAD_QUALITIES.map((option) => (
                <ToggleButton
                  enabled={enabledTriadQualities.has(option.value)}
                  key={option.value}
                  label={option.label}
                  onClick={() => onTriadQualityToggle(option.value)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Positions
            </legend>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {TRIAD_POSITIONS.map((option) => (
                <ToggleButton
                  enabled={enabledTriadPositions.has(option.value)}
                  key={option.value}
                  label={option.label}
                  onClick={() => onTriadPositionToggle(option.value)}
                />
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/10 px-3 py-3">
        <span>
          <span className="block text-sm font-semibold text-white">
            Show target name
          </span>

          <span className="mt-1 block text-xs text-white/50">
            Display the note or triad above the staff.
          </span>
        </span>

        <input
          checked={showTargetName}
          className="h-5 w-5 accent-sky-400"
          onChange={(event) => onShowTargetNameChange(event.target.checked)}
          type="checkbox"
        />
      </label>
    </section>
  );
}
