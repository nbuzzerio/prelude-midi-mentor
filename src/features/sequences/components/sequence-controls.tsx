import type {
  PracticeClefMode,
  SequenceArpeggio,
  SequenceDirection,
  SequenceExerciseType,
  SequenceInterval,
  SequenceNoteCategory,
  SequenceScale,
} from "@/types/practice";

type SequenceControlsProps = Readonly<{
  enabledArpeggios: ReadonlySet<SequenceArpeggio>;
  enabledDirections: ReadonlySet<SequenceDirection>;
  enabledIntervals: ReadonlySet<SequenceInterval>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
  enabledScales: ReadonlySet<SequenceScale>;
  exerciseType: SequenceExerciseType;
  mode: PracticeClefMode;
  showTargetName: boolean;
  onArpeggioToggle: (arpeggio: SequenceArpeggio) => void;
  onDirectionToggle: (direction: SequenceDirection) => void;
  onExerciseTypeChange: (exerciseType: SequenceExerciseType) => void;
  onIntervalToggle: (interval: SequenceInterval) => void;
  onModeChange: (mode: PracticeClefMode) => void;
  onNoteCategoryToggle: (category: SequenceNoteCategory) => void;
  onReset: () => void;
  onScaleToggle: (scale: SequenceScale) => void;
  onShowTargetNameChange: (enabled: boolean) => void;
}>;

type ToggleButtonProps = Readonly<{
  enabled: boolean;
  label: string;
  onClick: () => void;
}>;

const EXERCISE_TYPE_OPTIONS: ReadonlyArray<
  Readonly<{
    label: string;
    value: SequenceExerciseType;
  }>
> = [
  {
    label: "Intervals",
    value: "intervals",
  },
  {
    label: "Scales",
    value: "scales",
  },
  {
    label: "Arpeggios",
    value: "arpeggios",
  },
];

const CLEF_OPTIONS: ReadonlyArray<
  Readonly<{
    label: string;
    value: PracticeClefMode;
  }>
> = [
  {
    label: "Bass",
    value: "bass",
  },
  {
    label: "Treble",
    value: "treble",
  },
  {
    label: "Mixed",
    value: "mixed",
  },
];

const DIRECTION_OPTIONS: ReadonlyArray<
  Readonly<{
    label: string;
    value: SequenceDirection;
  }>
> = [
  {
    label: "Ascending",
    value: "ascending",
  },
  {
    label: "Descending",
    value: "descending",
  },
];

const NOTE_CATEGORY_OPTIONS: ReadonlyArray<
  Readonly<{
    label: string;
    value: SequenceNoteCategory;
  }>
> = [
  {
    label: "Naturals",
    value: "naturals",
  },
  {
    label: "Accidentals",
    value: "accidentals",
  },
];

const INTERVAL_OPTIONS: ReadonlyArray<
  Readonly<{
    label: string;
    value: SequenceInterval;
  }>
> = [
  {
    label: "Minor 2nd",
    value: "minor-second",
  },
  {
    label: "Major 2nd",
    value: "major-second",
  },
  {
    label: "Minor 3rd",
    value: "minor-third",
  },
  {
    label: "Major 3rd",
    value: "major-third",
  },
  {
    label: "Perfect 4th",
    value: "perfect-fourth",
  },
  {
    label: "Perfect 5th",
    value: "perfect-fifth",
  },
  {
    label: "Minor 6th",
    value: "minor-sixth",
  },
  {
    label: "Major 6th",
    value: "major-sixth",
  },
  {
    label: "Minor 7th",
    value: "minor-seventh",
  },
  {
    label: "Major 7th",
    value: "major-seventh",
  },
  {
    label: "Octave",
    value: "octave",
  },
];

const SCALE_OPTIONS: ReadonlyArray<
  Readonly<{
    label: string;
    value: SequenceScale;
  }>
> = [
  {
    label: "Major",
    value: "major",
  },
  {
    label: "Natural Minor",
    value: "natural-minor",
  },
];

const ARPEGGIO_OPTIONS: ReadonlyArray<
  Readonly<{
    label: string;
    value: SequenceArpeggio;
  }>
> = [
  {
    label: "Major",
    value: "major",
  },
  {
    label: "Minor",
    value: "minor",
  },
];

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

export default function SequenceControls({
  enabledArpeggios,
  enabledDirections,
  enabledIntervals,
  enabledNoteCategories,
  enabledScales,
  exerciseType,
  mode,
  onArpeggioToggle,
  onDirectionToggle,
  onExerciseTypeChange,
  onIntervalToggle,
  onModeChange,
  onNoteCategoryToggle,
  onReset,
  onScaleToggle,
  onShowTargetNameChange,
  showTargetName,
}: SequenceControlsProps) {
  const targetNameLabel =
    exerciseType === "intervals"
      ? "Show interval name"
      : exerciseType === "scales"
        ? "Show scale name"
        : "Show arpeggio name";

  const targetNameDescription =
    exerciseType === "intervals"
      ? "Display the interval and direction above the notation."
      : exerciseType === "scales"
        ? "Display the scale and direction above the notation."
        : "Display the arpeggio and direction above the notation.";

  return (
    <section
      aria-label="Sequence settings"
      className="rounded-xl border border-white/10 bg-white/5 p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white">Sequence settings</h2>

          <p className="mt-1 text-sm text-white/50">
            Configure melodic practice.
          </p>
        </div>

        <button
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
          onClick={onReset}
          type="button"
        >
          Reset session
        </button>
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Exercise
        </legend>

        <div className="mt-2 flex flex-wrap gap-2">
          {EXERCISE_TYPE_OPTIONS.map((option) => (
            <ToggleButton
              enabled={exerciseType === option.value}
              key={option.value}
              label={option.label}
              onClick={() => {
                onExerciseTypeChange(option.value);
              }}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Clef
        </legend>

        <div className="mt-2 flex flex-wrap gap-2">
          {CLEF_OPTIONS.map((option) => (
            <ToggleButton
              enabled={mode === option.value}
              key={option.value}
              label={option.label}
              onClick={() => {
                onModeChange(option.value);
              }}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Direction
        </legend>

        <div className="mt-2 flex flex-wrap gap-2">
          {DIRECTION_OPTIONS.map((option) => (
            <ToggleButton
              enabled={enabledDirections.has(option.value)}
              key={option.value}
              label={option.label}
              onClick={() => {
                onDirectionToggle(option.value);
              }}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Starting notes
        </legend>

        <div className="mt-2 flex flex-wrap gap-2">
          {NOTE_CATEGORY_OPTIONS.map((option) => (
            <ToggleButton
              enabled={enabledNoteCategories.has(option.value)}
              key={option.value}
              label={option.label}
              onClick={() => {
                onNoteCategoryToggle(option.value);
              }}
            />
          ))}
        </div>
      </fieldset>

      {exerciseType === "intervals" ? (
        <fieldset className="mt-5">
          <legend className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Intervals
          </legend>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {INTERVAL_OPTIONS.map((option) => (
              <ToggleButton
                enabled={enabledIntervals.has(option.value)}
                key={option.value}
                label={option.label}
                onClick={() => {
                  onIntervalToggle(option.value);
                }}
              />
            ))}
          </div>
        </fieldset>
      ) : exerciseType === "scales" ? (
        <fieldset className="mt-5">
          <legend className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Scales
          </legend>

          <div className="mt-2 grid grid-cols-2 gap-2">
            {SCALE_OPTIONS.map((option) => (
              <ToggleButton
                enabled={enabledScales.has(option.value)}
                key={option.value}
                label={option.label}
                onClick={() => onScaleToggle(option.value)}
              />
            ))}
          </div>
        </fieldset>
      ) : (
        <fieldset className="mt-5">
          <legend className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Arpeggios
          </legend>

          <div className="mt-2 grid grid-cols-2 gap-2">
            {ARPEGGIO_OPTIONS.map((option) => (
              <ToggleButton
                enabled={enabledArpeggios.has(option.value)}
                key={option.value}
                label={option.label}
                onClick={() => onArpeggioToggle(option.value)}
              />
            ))}
          </div>
        </fieldset>
      )}

      <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/10 px-3 py-3">
        <span>
          <span className="block text-sm font-semibold text-white">
            {targetNameLabel}
          </span>

          <span className="mt-1 block text-xs text-white/50">
            {targetNameDescription}
          </span>
        </span>

        <input
          checked={showTargetName}
          className="h-5 w-5 accent-sky-400"
          onChange={(event) => {
            onShowTargetNameChange(event.target.checked);
          }}
          type="checkbox"
        />
      </label>
    </section>
  );
}
