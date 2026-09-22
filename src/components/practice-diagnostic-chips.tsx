export type PracticeDiagnosticChip = Readonly<{
  id: "pitch-problem" | "identification" | "hesitation" | "retried" | "skipped" | "melody-pitch-metric" | "melody-movement-metric" | "melody-timing-metric";
  kind: "problem" | "process" | "metric";
  label: "Pitch" | "Identification" | "Hesitation" | "Retried" | "Skipped" | "Movement" | "Timing";
  accessibleText: string;
  count?: number;
  value?: string;
}>;

export function PracticeDiagnosticChips({ chips, label = "Practice diagnostic shorthand" }: Readonly<{
  chips: readonly PracticeDiagnosticChip[];
  label?: string;
}>) {
  if (chips.length === 0) return null;
  return <ul aria-label={label} className="flex flex-wrap gap-2">
    {chips.map((chip) => <li
      aria-label={chip.accessibleText}
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${chip.kind === "problem" ? "border-rose-300/40 bg-rose-300/10" : chip.kind === "process" ? "border-amber-300/40 bg-amber-300/10" : "border-sky-300/40 bg-sky-300/10"}`}
      data-diagnostic-chip={chip.id}
      data-diagnostic-kind={chip.kind}
      key={chip.id}
    >
      {chip.label}{chip.value ? ` ${chip.value}` : ""}{chip.count === undefined ? "" : ` ×${chip.count}`}
    </li>)}
  </ul>;
}
