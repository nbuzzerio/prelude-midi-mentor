import { createMicrophoneCapture as createCapture, type CaptureOptions } from "@/lib/audio/monophonic/microphone-capture";
export type { CaptureState, CaptureStatus } from "@/lib/audio/monophonic/microphone-capture";

/** Tuner wording and independently owned capture; implementation is shared. */
export function createMicrophoneCapture(options: CaptureOptions) {
  return createCapture({
    unavailableMessage: "Listening is available only in the foreground tuner, with no active Practice Session.",
    eligibilityLostMessage: "Listening stopped because the tuner is no longer eligible. Press Start Listening to restart.",
    ...options,
  });
}
