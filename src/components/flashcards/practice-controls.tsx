import type { PracticeMode } from "@/types/practice";

type PracticeControlsProps = Readonly<{
  mode: PracticeMode;
  onModeChange: (mode: PracticeMode) => void;
  onReset: () => void;
}>;

const MODES: ReadonlyArray<{
  label: string;
  value: PracticeMode;
}> = [
  { label: "Bass", value: "bass" },
  { label: "Treble", value: "treble" },
  { label: "Mixed", value: "mixed" },
];

export default function PracticeControls({
  mode,
  onModeChange,
  onReset,
}: PracticeControlsProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Practice mode</p>

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
