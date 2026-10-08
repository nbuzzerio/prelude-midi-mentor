export type AppUpdate = Readonly<{
  id: string;
  sequence: number;
  title: string;
  date: string;
  version?: string;
  changes: readonly string[];
}>;

export type AppUpdateAcknowledgment = Readonly<{ id: string; sequence: number }>;

// Append in increasing sequence order. IDs/sequences never change after publication.
export const APP_UPDATES: readonly AppUpdate[] = [{
  id: "2026-10-05-update-notices",
  sequence: 1,
  title: "Updates are now easier to manage",
  date: "2026-10-05",
  version: "2.8.8",
  changes: [
    "Prelude lets you know when an update is ready, so you can choose when to reload.",
    "What's New summarizes product updates you haven't acknowledged yet.",
  ],
}, {
  id: "2026-10-06-acoustic-piece-practice",
  sequence: 2,
  title: "Practice with violin and ocarina",
  date: "2026-10-06",
  version: "2.9.0",
  changes: [
    "Provisional microphone input brings supported monophonic violin and ocarina practice to Piece Practice.",
    "Adjustable pitch tolerance lets you practice with instruments that run a little sharp or flat.",
  ],
}, {
  id: "2026-10-07-violin-preflight-analysis",
  sequence: 3,
  title: "Check violin tuning before practice",
  date: "2026-10-07",
  version: "2.9.1",
  changes: [
    "A provisional open-string preflight checks G, D, A and E before violin microphone practice, with Retry, Skip and tuning guidance.",
    "Export bounded local scalar pitch evidence as JSON for your own analysis. No audio is recorded or uploaded; evidence is temporary until exported.",
    "Concert-pitch targets and practice acceptance remain unchanged. Ocarina calibration and instrument diagrams are still future work.",
  ],
}];

export function assertAppUpdateCatalog(updates: readonly AppUpdate[]): void {
  const ids = new Set<string>();
  let previousSequence = 0;
  for (const update of updates) {
    if (!update.id.trim() || ids.has(update.id) || !Number.isSafeInteger(update.sequence) || update.sequence <= previousSequence
      || !update.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(update.date)
      || !update.changes.length || update.changes.some((change) => !change.trim())) {
      throw new Error("Product updates need unique IDs, increasing positive sequences, dates, titles and changes.");
    }
    ids.add(update.id); previousSequence = update.sequence;
  }
}

export function parseAppUpdateAcknowledgment(value: unknown): AppUpdateAcknowledgment | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && candidate.id.trim().length > 0
    && typeof candidate.sequence === "number" && Number.isSafeInteger(candidate.sequence) && candidate.sequence > 0
    ? { id: candidate.id, sequence: candidate.sequence } : null;
}

export function unseenAppUpdates(updates: readonly AppUpdate[], acknowledgment: AppUpdateAcknowledgment | null): readonly AppUpdate[] {
  assertAppUpdateCatalog(updates);
  const newest = updates.at(-1);
  if (!newest) return [];
  const seen = parseAppUpdateAcknowledgment(acknowledgment);
  if (seen && seen.sequence > newest.sequence) return [];
  const known = seen && updates.some((update) => update.id === seen.id && update.sequence === seen.sequence);
  return known ? updates.filter((update) => update.sequence > seen.sequence).reverse() : [newest];
}

assertAppUpdateCatalog(APP_UPDATES);
