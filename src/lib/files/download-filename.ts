export type DownloadExtension = "prelude.json" | "json" | "mid" | "webm" | "m4a" | "ogg";

const MAX_NAME_BYTES = 120;

/** A flat, recognizable filename stem; never a path. Preserve Unicode spelling. */
export function sanitizeDownloadName(name: string, fallback: string): string {
  const normalize = (value: string) => value.normalize("NFC").toLowerCase()
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, "_")
    .replace(/^[_\p{M}]+|_+$/gu, "");
  const candidate = normalize(name) || normalize(fallback) || "export";
  let stem = "", bytes = 0;
  for (const point of candidate) {
    const length = new TextEncoder().encode(point).length;
    if (bytes + length > MAX_NAME_BYTES) break;
    stem += point; bytes += length;
  }
  return stem.replace(/_+$/u, "") || "export";
}

export function formatDownloadNumber(number: string): string | null {
  const trimmed = number.trim();
  if (!/^\d{1,3}$/.test(trimmed) || Number(trimmed) < 1) return null;
  return trimmed.padStart(3, "0");
}

export function downloadFilename(name: string, extension: DownloadExtension, fallback: string, number = "001"): string {
  const formatted = formatDownloadNumber(number);
  if (!formatted) throw new Error("Choose a download number from 001 to 999. 000 is reserved.");
  return `${sanitizeDownloadName(name, fallback)}_${formatted}.${extension}`;
}
