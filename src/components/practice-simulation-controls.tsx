type PracticeSimulationControlsProps = Readonly<{
  onCorrect: () => void;
  onIncorrect: () => void;
}>;

export default function PracticeSimulationControls({
  onCorrect,
  onIncorrect,
}: PracticeSimulationControlsProps) {
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div
      aria-label="Development simulation controls"
      className="absolute right-3 top-3 z-10 flex gap-1.5"
    >
      <button
        className="rounded-md border border-sky-400/40 bg-zinc-950/90 px-2 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-400/15"
        onClick={onCorrect}
        type="button"
      >
        Correct
      </button>

      <button
        className="rounded-md border border-red-400/40 bg-zinc-950/90 px-2 py-1 text-xs font-semibold text-red-200 hover:bg-red-400/15"
        onClick={onIncorrect}
        type="button"
      >
        Incorrect
      </button>
    </div>
  );
}
