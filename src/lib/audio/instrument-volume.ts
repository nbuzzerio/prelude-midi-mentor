const DEFAULT_INSTRUMENT_VOLUME = 0.5;
const INSTRUMENT_VOLUME_STORAGE_KEY = "prelude-instrument-volume";

let instrumentVolume: number | null = null;

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}

function loadStoredVolume(): number {
  if (typeof window === "undefined") {
    return DEFAULT_INSTRUMENT_VOLUME;
  }

  const storedVolume = window.localStorage.getItem(
    INSTRUMENT_VOLUME_STORAGE_KEY,
  );

  if (storedVolume === null) {
    return DEFAULT_INSTRUMENT_VOLUME;
  }

  const parsedVolume = Number(storedVolume);

  if (!Number.isFinite(parsedVolume)) {
    return DEFAULT_INSTRUMENT_VOLUME;
  }

  return clampVolume(parsedVolume);
}

export function getInstrumentVolume(): number {
  instrumentVolume ??= loadStoredVolume();

  return instrumentVolume;
}

export function setInstrumentVolume(volume: number): void {
  instrumentVolume = clampVolume(volume);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      INSTRUMENT_VOLUME_STORAGE_KEY,
      String(instrumentVolume),
    );
  }
}
