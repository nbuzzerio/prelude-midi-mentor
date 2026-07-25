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
  onReset: () => void;
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
          <div className="rounded-xl bg-zinc-100">
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-200">
              <input
                checked={individualNotesEnabled}
                onChange={() => onExerciseTypeToggle("notes")}
                type="checkbox"
              />
              Individual notes
            </label>

            <div className="flex flex-col gap-2 border-t border-zinc-200 px-4 py-3 pl-10">
              {NOTE_CATEGORIES.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 text-sm font-medium text-zinc-600"
                >
                  <input
                    checked={enabledNoteCategories.has(option.value)}
                    onChange={() => onNoteCategoryToggle(option.value)}
                    type="checkbox"
                  />

                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-zinc-100">
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-200">
              <input
                checked={triadsEnabled}
                onChange={() => onExerciseTypeToggle("triads")}
                type="checkbox"
              />
              Triads
            </label>

            <div className="grid gap-4 border-t border-zinc-200 px-4 py-3 pl-10 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Qualities
                </p>

                <div className="flex flex-col gap-2">
                  {TRIAD_QUALITIES.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-3 text-sm font-medium text-zinc-600"
                    >
                      <input
                        checked={enabledTriadQualities.has(option.value)}
                        onChange={() => onTriadQualityToggle(option.value)}
                        type="checkbox"
                      />

                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Positions
                </p>

                <div className="flex flex-col gap-2">
                  {TRIAD_POSITIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-3 text-sm font-medium text-zinc-600"
                    >
                      <input
                        checked={enabledTriadPositions.has(option.value)}
                        onChange={() => onTriadPositionToggle(option.value)}
                        type="checkbox"
                      />

                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Display</p>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-200">
          <input
            checked={showTargetName}
            onChange={(event) => onShowTargetNameChange(event.target.checked)}
            type="checkbox"
          />
          Show target name
        </label>
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
