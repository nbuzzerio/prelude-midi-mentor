import type { AnalysisData } from "./acoustic-analysis-types";

/** Confirmed attempt summaries only: no physical-onset or convergence claims. */
export function summarizeAcousticAnalysis(data: AnalysisData) {
  return data.targetVisits.map((visit) => {
    const values = data.attempts.filter((attempt) => attempt.targetVisitId === visit.id).map(({ evidence }) => evidence.centsFromExpected);
    const sorted = [...values].sort((a, b) => a - b);
    return { targetVisitId: visit.id, algorithmVersion: 1, basis: "confirmed-graded-attacks", count: values.length,
      firstDeviationCents: values[0] ?? null,
      bestDeviationCents: values.reduce<number | null>((best, value) => best === null || Math.abs(value) < Math.abs(best) ? value : best, null),
      finalDeviationCents: values.at(-1) ?? null,
      medianBiasCents: sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : null,
      acquisitionTimeMs: null, postAcquisitionStability: "unassignable", actualPhysicalLocation: "unknown" };
  });
}
