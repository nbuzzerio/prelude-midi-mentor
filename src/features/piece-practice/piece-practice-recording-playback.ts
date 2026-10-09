/** Stop only Prelude's temporary performance players before acquiring a microphone. */
export function stopPiecePracticeRecordingPlayback() {
  document.querySelectorAll<HTMLAudioElement>("audio[data-piece-practice-recording]").forEach((player) => {
    try { if (!player.paused) player.pause(); } catch { /* Playback support must not block practice or capture. */ }
  });
}
