import type { PracticeStats } from "@/types/practice";

type PracticeStatsProps = Readonly<{
  stats: PracticeStats;
}>;

function getAccuracy(stats: PracticeStats): number {
  const total = stats.correct + stats.incorrect;

  if (total === 0) {
    return 0;
  }

  return Math.round((stats.correct / total) * 100);
}

function getAverageResponseTime(stats: PracticeStats): string {
  if (stats.correct === 0) {
    return "—";
  }

  const averageMs = stats.totalResponseTimeMs / stats.correct;

  return `${(averageMs / 1000).toFixed(1)}s`;
}

export default function PracticeStats({ stats }: PracticeStatsProps) {
  const items = [
    { label: "Correct", value: stats.correct },
    { label: "Incorrect", value: stats.incorrect },
    { label: "Accuracy", value: `${getAccuracy(stats)}%` },
    { label: "Streak", value: stats.streak },
    { label: "Avg. time", value: getAverageResponseTime(stats) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-zinc-200 bg-white p-4 text-center"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
