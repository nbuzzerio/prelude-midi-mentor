import type {
  PracticeClefMode,
  SequenceDirection,
  SequenceInterval,
  SequenceNoteCategory,
} from "@/types/practice";

type SequenceControlsProps = Readonly<{
  enabledDirections: ReadonlySet<SequenceDirection>;
  enabledIntervals: ReadonlySet<SequenceInterval>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
  mode: PracticeClefMode;
  showTargetName: boolean;
  onDirectionToggle: (direction: SequenceDirection) => void;
  onIntervalToggle: (interval: SequenceInterval) => void;
  onModeChange: (mode: PracticeClefMode) => void;
  onNoteCategoryToggle: (category: SequenceNoteCategory) => void;
  onReset: () => void;
  onShowTargetNameChange: (enabled: boolean) => void;
}>;

type ToggleButtonProps = Readonly<{
  enabled: boolean;
  label: string;
  onClick: () => void;
}>;

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
  enabledDirections,
  enabledIntervals,
  enabledNoteCategories,
  mode,
  onDirectionToggle,
  onIntervalToggle,
  onModeChange,
  onNoteCategoryToggle,
  onReset,
  onShowTargetNameChange,
  showTargetName,
}: SequenceControlsProps) {
  return (
    <section
      aria-label="Sequence settings"
      className="rounded-xl border border-white/10 bg-white/5 p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white">Sequence settings</h2>

          <p className="mt-1 text-sm text-white/50">
            Configure melodic interval practice.
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

      <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/10 px-3 py-3">
        <span>
          <span className="block text-sm font-semibold text-white">
            Show interval name
          </span>

          <span className="mt-1 block text-xs text-white/50">
            Display the interval and direction above the notation.
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
