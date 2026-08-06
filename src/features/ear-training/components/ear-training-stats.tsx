import {
  getAverageEarTrainingResponseTimeMs,
  getEarTrainingAccuracy,
} from "../ear-training-stats";
import type { EarTrainingStats } from "../ear-training-types";

export default function EarTrainingStatsView({ stats }: { stats: EarTrainingStats }) {
  const average = getAverageEarTrainingResponseTimeMs(stats);
  const items = [
    ["Completed", stats.completed],
    ["Accuracy", `${getEarTrainingAccuracy(stats)}%`],
    ["Streak", stats.streak],
    ["Avg. time", average === 0 ? "—" : `${(average / 1000).toFixed(1)}s`],
  ];
  return <section aria-label="Ear Training session statistics" className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-4">
    {items.map(([label, value]) => <div key={label}><p className="text-xs font-semibold uppercase tracking-wider text-white/50">{label}</p><p className="mt-1 text-2xl font-bold text-white">{value}</p></div>)}
  </section>;
}
