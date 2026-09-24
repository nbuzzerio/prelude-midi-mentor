import { WEEKLY_PRACTICE_LIMITS } from "./weekly-practice-contract";

export type WeeklyPracticeFileReadResult = Readonly<{ ok: true; text: string }> | Readonly<{ ok: false; reason: "too-large" | "read-failed"; message: string }>;

export async function readWeeklyPracticeJsonFile(file: Pick<File, "size" | "text">): Promise<WeeklyPracticeFileReadResult> {
  if (file.size > WEEKLY_PRACTICE_LIMITS.jsonBytes) return { ok: false, reason: "too-large", message: `Weekly Practice JSON must be ${WEEKLY_PRACTICE_LIMITS.jsonBytes} bytes or smaller.` };
  try { return { ok: true, text: await file.text() }; }
  catch { return { ok: false, reason: "read-failed", message: "Prelude could not read that JSON file. Try selecting it again." }; }
}
