const DEFAULT_FEEDBACK_VOLUME = 0.25;
const FEEDBACK_VOLUME_STORAGE_KEY = "prelude-feedback-volume";

let audioContext: AudioContext | null = null;
let feedbackVolume: number | null = null;

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}

function loadStoredVolume(): number {
  if (typeof window === "undefined") {
    return DEFAULT_FEEDBACK_VOLUME;
  }

  const storedVolume = window.localStorage.getItem(FEEDBACK_VOLUME_STORAGE_KEY);

  if (storedVolume === null) {
    return DEFAULT_FEEDBACK_VOLUME;
  }

  const parsedVolume = Number(storedVolume);

  if (!Number.isFinite(parsedVolume)) {
    return DEFAULT_FEEDBACK_VOLUME;
  }

  return clampVolume(parsedVolume);
}

export function getFeedbackVolume(): number {
  feedbackVolume ??= loadStoredVolume();

  return feedbackVolume;
}

export function setFeedbackVolume(volume: number): void {
  feedbackVolume = clampVolume(volume);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      FEEDBACK_VOLUME_STORAGE_KEY,
      String(feedbackVolume),
    );
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  audioContext ??= new AudioContextConstructor();

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
}

function playTone(
  frequency: number,
  startTime: number,
  durationSeconds: number,
): void {
  const volume = getFeedbackVolume();

  if (volume === 0) {
    return;
  }

  const context = getAudioContext();

  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);

  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);

  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + durationSeconds);
}

export function playCorrectFeedback(): void {
  const context = getAudioContext();

  if (!context || getFeedbackVolume() === 0) {
    return;
  }

  const startTime = context.currentTime;

  playTone(523.25, startTime, 0.16);
  playTone(659.25, startTime + 0.1, 0.2);
}

export function playIncorrectFeedback(): void {
  const context = getAudioContext();

  if (!context || getFeedbackVolume() === 0) {
    return;
  }

  const startTime = context.currentTime;

  playTone(220, startTime, 0.12);
  playTone(196, startTime + 0.07, 0.16);
}
