import { formatDownloadNumber, sanitizeDownloadName, type DownloadExtension } from "./download-filename";

type CounterStorage = Pick<Storage, "getItem" | "setItem">;
export type DownloadCounterSuggestion = Readonly<{ number: string; exhausted: boolean; message: string }>;
const PREFIX = "prelude-download-counter-v1:";
const unavailable = "Filename numbers are remembered for this tab only; browser storage is unavailable.";
const corrupt = "The remembered filename number could not be read. Check the suggestion before exporting.";

/** Filename preferences only. No filesystem inspection, permissions, or musical identities. */
export class DownloadCounters {
  private readonly fallback = new Map<string, number>();
  constructor(private readonly storage: () => CounterStorage = () => window.localStorage) {}

  key(name: string, extension: DownloadExtension, fallback: string): string {
    return PREFIX + JSON.stringify([sanitizeDownloadName(name, fallback), extension]);
  }

  private read(key: string): { highWater: number; message: string; readable: boolean } {
    const retained = this.fallback.get(key) ?? 0;
    try {
      const text = this.storage().getItem(key);
      if (text === null) return { highWater: retained, message: retained ? unavailable : "", readable: true };
      const record: unknown = JSON.parse(text);
      if (!record || typeof record !== "object" || !("version" in record) || record.version !== 1
        || !("highWater" in record) || typeof record.highWater !== "number"
        || !Number.isInteger(record.highWater) || record.highWater < 1 || record.highWater > 999) {
        return { highWater: retained, message: corrupt, readable: true };
      }
      return { highWater: Math.max(retained, record.highWater), message: retained ? unavailable : "", readable: true };
    } catch (error) {
      return { highWater: retained, message: error instanceof SyntaxError ? corrupt : unavailable, readable: error instanceof SyntaxError };
    }
  }

  private suggestion(highWater: number, message: string): DownloadCounterSuggestion {
    return { number: highWater === 999 ? "" : String(highWater + 1).padStart(3, "0"), exhausted: highWater === 999, message };
  }

  suggest(name: string, extension: DownloadExtension, fallback: string): DownloadCounterSuggestion {
    const { highWater, message } = this.read(this.key(name, extension, fallback));
    return this.suggestion(highWater, message);
  }

  /** Call once after acknowledged delivery. Re-read other tabs before merging; not an atomic reservation. */
  acknowledge(name: string, extension: DownloadExtension, fallback: string, number: string): DownloadCounterSuggestion {
    const formatted = formatDownloadNumber(number);
    if (!formatted) throw new Error("Choose a download number from 001 to 999. 000 is reserved.");
    const key = this.key(name, extension, fallback);
    const previous = this.read(key);
    const highWater = Math.max(previous.highWater, Number(formatted));
    this.fallback.set(key, highWater);
    try {
      this.storage().setItem(key, JSON.stringify({ version: 1, highWater }));
      if (previous.readable) this.fallback.delete(key);
      return this.suggestion(highWater, previous.readable ? "" : unavailable);
    } catch { return this.suggestion(highWater, unavailable); }
  }
}

export const downloadCounters = new DownloadCounters();
