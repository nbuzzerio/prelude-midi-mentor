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
}, {
  id: "2026-10-10-improv-workspace",
  sequence: 9,
  title: "Preserve your first piano take",
  date: "2026-10-10",
  version: "2.9.13",
  changes: [
    "Improv records uninterrupted performances from one selected physical MIDI input: sight-read from your own book or explore freely without accuracy grading.",
    "Named browser-local collections preserve the original first take and numbered later attempts, with confirmed saves, descriptive review and approximate piano replay.",
    "Download MIDI projections or full JSON collection backups; restore backups into separate histories. Browser storage can be cleared or evicted. Room audio is still deferred.",
  ],
}, {
  id: "2026-10-10-improv-room-audio",
  sequence: 10,
  title: "Record the sound of your piano in Improv",
  date: "2026-10-10",
  version: "2.9.14",
  changes: [
    "Record microphone sound alongside Improv MIDI, off by default. Preview/download temporary audio in the browser's format; alignment is approximate.",
    "Audio is not permanently stored or included in MIDI/JSON backups. MIDI stays browser-local, subject to eviction. No accuracy grading; physical audio fidelity still needs testing.",
  ],
}, {
  id: "2026-10-11-staff-builder-qol",
  sequence: 11,
  title: "Read and protect your Staff Builder scores",
  date: "2026-10-11",
  version: "2.9.15",
  changes: [
    "Open Study View directly from a saved piece in the library, with full-sheet notation and printing.",
    "Lock Editing keeps the score and pending pitches read-only while your piano remains connected. Unlock to resume; opening another piece starts unlocked.",
  ],
}, {
  id: "2026-10-11-improv-rolling-staff",
  sequence: 12,
  title: "See recent playing in Improv",
  date: "2026-10-11",
  version: "2.9.16",
  changes: [
    "Improv now keeps recent notes on a scrolling grand staff with a blue elapsed-time playhead and key-down duration trails.",
    "Reopen saved takes and explore earlier or later time windows. This is observed MIDI performance, not automatically transcribed or rhythmically validated sheet music.",
    "Optional room audio remains temporary until downloaded and is not included in MIDI or JSON backups.",
  ],
}, {
  id: "2026-10-11-improv-pause-resume",
  sequence: 13,
  title: "Pause and continue an Improv take",
  date: "2026-10-11",
  version: "2.9.17",
  changes: [
    "Pause and Resume keep the same take in sight-reading and free improvisation. Musical time, the rolling staff, replay and MIDI downloads exclude intentional breaks.",
    "Paused MIDI remains original continuity evidence in JSON backups. Resume waits for local control acknowledgment; temporary room audio pauses with the take where supported.",
    "Room audio remains temporary until downloaded. Its browser timing is approximate, and an independent microphone failure leaves healthy MIDI capture available.",
  ],
}, {
  id: "2026-10-11-download-filenames",
  sequence: 14,
  title: "Choose your download filenames",
  date: "2026-10-11",
  version: "2.9.19",
  changes: [
    "Score, MIDI, JSON and microphone downloads now let you edit the name and choose a number from 001 to 999. Every download starts at 001; 000 is reserved and no counter is remembered.",
    "Filename numbers never change Improv take identities. Original file contents and native audio formats remain unchanged; your browser handles the download location and duplicate names.",
    "Print / Save as PDF stays in the browser's print dialog. Temporary audio remains in this page until you explicitly discard it; verify downloaded files first.",
  ],
}, {
  id: "2026-10-12-preferred-export-folder",
  sequence: 15,
  title: "Choose where Save As starts",
  date: "2026-10-12",
  version: "2.9.20",
  changes: [
    "Settings → Exports can remember a preferred starting folder for optional native Save As in supported secure browsers. The preference is local to this browser/device and may need renewed access.",
    "Save As uses your filename preview and reports Saved only after writing closes successfully. Download Normally remains an explicit browser-download request; no automatic destination or suffix counter is added.",
    "Confirming replacement of an existing file may erase its contents before Prelude writes, even if saving later fails. Original exports and temporary recordings remain available for retry; aborting does not guarantee restoration.",
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
