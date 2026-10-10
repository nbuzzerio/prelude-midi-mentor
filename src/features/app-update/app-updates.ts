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
}, {
  id: "2026-10-09-local-performance-recording",
  sequence: 4,
  title: "Listen back to your Piece Practice performances",
  date: "2026-10-09",
  version: "2.9.4",
  changes: [
    "Opt in to local violin or ocarina performance recording during Piece Practice. Calibration is excluded.",
    "Play back and download temporary recording segments before leaving or closing the page. Audio is never automatically uploaded.",
    "Recording does not change pitch grading, scalar analysis JSON, reports or saved run evidence.",
  ],
}, {
  id: "2026-10-09-piano-performance-recording",
  sequence: 5,
  title: "Record audible piano performances",
  date: "2026-10-09",
  version: "2.9.5",
  changes: [
    "Piano Piece Practice now offers optional local microphone recording while MIDI continues to handle note grading.",
    "Record the piano sound audible in the room, then play back and download separate temporary segments. Headphones-only piano output may not be captured.",
    "Recording defaults Off, never automatically uploads audio, and can fail or stop without interrupting MIDI practice. Resume recording explicitly after an interruption.",
  ],
}, {
  id: "2026-10-09-violin-fingerboard",
  sequence: 6,
  title: "Find violin notes in first position",
  date: "2026-10-09",
  version: "2.9.6",
  changes: [
    "Violin microphone Piece Practice now shows a beginner first-position fingerboard with suggested strings, alternatives and optional pitch-name stickers.",
    "Expected notes and live pitch-derived possible locations use separate markers. Microphone pitch cannot identify your actual string or finger.",
    "The schematic guide does not change calibration, grading or recording. Ocarina fingering diagrams still require a verified instrument chart.",
  ],
}, {
  id: "2026-10-10-piece-practice-layout",
  sequence: 7,
  title: "Keep the music in view while practicing",
  date: "2026-10-10",
  version: "2.9.7",
  changes: [
    "Piece Practice puts playing feedback, notation and the violin guide ahead of recording controls, practice details and acoustic exports.",
    "The violin guide enlarges proportional first-position spacing and puts string, sticker and alternate-location controls in a disclosure.",
    "Recording notices remain visible near the playing area. Grading, calibration, recording and saved evidence are unchanged.",
  ],
}, {
  id: "2026-10-10-ocarina-fingering",
  sequence: 8,
  title: "See which ocarina holes to cover",
  date: "2026-10-10",
  version: "2.9.8",
  changes: [
    "Ocarina microphone Piece Practice now shows front and back fingering diagrams for thirteen natural pitches in a provisional Standard 12-hole Alto C profile.",
    "Expected fingering and live pitch-derived suggestions stay separate. The microphone cannot identify your actual covered holes; unsupported pitches show no verified fingering.",
    "The manufacturer's chart and subhole layout remain unverified. Grading, calibration, recording and saved evidence are unchanged.",
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
