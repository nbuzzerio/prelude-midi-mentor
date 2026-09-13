export type StaffBuilderPrintRange = Readonly<{ start: number; end: number }>;
export type StaffBuilderPrintRangeResult = Readonly<{ ok: true; ranges: readonly StaffBuilderPrintRange[]; measureIndexes: readonly number[] }> | Readonly<{ ok: false; message: string }>;

export function parseStaffBuilderPrintRange(input: string, measureCount: number): StaffBuilderPrintRangeResult {
  if (!input.trim()) return { ok: false, message: "Enter at least one measure or range." };
  const ranges: StaffBuilderPrintRange[] = [];
  for (const raw of input.split(",")) {
    const match = raw.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) return { ok: false, message: `Invalid measure range: ${raw.trim() || "empty item"}.` };
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < 1) return { ok: false, message: "Measure numbers must be positive integers." };
    if (start > end) return { ok: false, message: `Range ${start}-${end} is reversed.` };
    if (end > measureCount) return { ok: false, message: `Measure ${end} is outside this ${measureCount}-measure piece.` };
    ranges.push({ start, end });
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: StaffBuilderPrintRange[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end + 1) merged[merged.length - 1] = { start: previous.start, end: Math.max(previous.end, range.end) };
    else merged.push(range);
  }
  return { ok: true, ranges: merged, measureIndexes: merged.flatMap(({ start, end }) => Array.from({ length: end - start + 1 }, (_, index) => start + index - 1)) };
}

export function entireStaffBuilderPrintRange(measureCount: number): StaffBuilderPrintRangeResult {
  return { ok: true, ranges: measureCount ? [{ start: 1, end: measureCount }] : [], measureIndexes: Array.from({ length: measureCount }, (_, index) => index) };
}
