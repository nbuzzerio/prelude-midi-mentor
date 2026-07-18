import type { PracticeClefMode, PracticeExerciseType } from "@/types/practice";

type PracticeControlsProps = Readonly<{
  enabledExerciseTypes: ReadonlySet<PracticeExerciseType>;
  mode: PracticeClefMode;
  onExerciseTypeToggle: (exerciseType: PracticeExerciseType) => void;
  onModeChange: (mode: PracticeClefMode) => void;
  onReset: () => void;
}>;

const MODES: ReadonlyArray<{
  label: string;
  value: PracticeClefMode;
}> = [
  { label: "Bass", value: "bass" },
  { label: "Treble", value: "treble" },
  { label: "Mixed", value: "mixed" },
];

const EXERCISE_TYPES: ReadonlyArray<{
  label: string;
  value: PracticeExerciseType;
}> = [
  { label: "Notes", value: "notes" },
  { label: "Triads", value: "triads" },
];

export default function PracticeControls({
  enabledExerciseTypes,
  mode,
  onExerciseTypeToggle,
  onModeChange,
  onReset,
}: PracticeControlsProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Clef</p>

        <div className="grid grid-cols-3 gap-2">
          {MODES.map((option) => {
            const isSelected = mode === option.value;

            return (
              <button
                key={option.value}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isSelected
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
                onClick={() => onModeChange(option.value)}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Exercise types</p>

        <div className="flex flex-col gap-2">
          {EXERCISE_TYPES.map((option) => {
            const isSelected = enabledExerciseTypes.has(option.value);

            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
              >
                <input
                  checked={isSelected}
                  onChange={() => onExerciseTypeToggle(option.value)}
                  type="checkbox"
                />

                {option.label}
              </label>
            );
          })}
        </div>
      </div>

      <button
        className="rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
        onClick={onReset}
        type="button"
      >
        Reset session
      </button>
    </div>
  );
}
