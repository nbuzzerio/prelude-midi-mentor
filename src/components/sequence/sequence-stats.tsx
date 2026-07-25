import type { SequenceStats as SequenceStatsData } from "@/types/practice";

type SequenceStatsProps = Readonly<{
  stats: SequenceStatsData;
}>;

function formatAverageTime(
  totalSequenceTimeMs: number,
  completed: number,
): string {
  if (completed === 0) {
    return "—";
  }

  const averageTimeMs = totalSequenceTimeMs / completed;

  return `${(averageTimeMs / 1000).toFixed(1)}s`;
}

function formatAccuracy(completed: number, incorrect: number): string {
  const totalAttempts = completed + incorrect;

  if (totalAttempts === 0) {
    return "—";
  }

  return `${Math.round((completed / totalAttempts) * 100)}%`;
}

export default function SequenceStats({ stats }: SequenceStatsProps) {
  const averageTime = formatAverageTime(
    stats.totalSequenceTimeMs,
    stats.completed,
  );

  const accuracy = formatAccuracy(stats.completed, stats.incorrectAttempts);

  return (
    <section
      aria-label="Sequence session statistics"
      className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-4"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Completed
        </p>

        <p className="mt-1 text-2xl font-bold text-white">{stats.completed}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Accuracy
        </p>

        <p className="mt-1 text-2xl font-bold text-white">{accuracy}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Streak
        </p>

        <p className="mt-1 text-2xl font-bold text-white">{stats.streak}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Avg. time
        </p>

        <p className="mt-1 text-2xl font-bold text-white">{averageTime}</p>
      </div>
    </section>
  );
}
