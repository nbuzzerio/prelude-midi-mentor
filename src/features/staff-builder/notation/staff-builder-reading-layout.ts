/** Opt-in music-stand presentation. All values are visual, never musical timing. */
export function getStaffBuilderReadingLayout(availableWidth: number, expanded: boolean) {
  const scale = expanded ? 2.2 : 1.8; // Native VexFlow staff lines are 10 units apart.
  const width = Number.isFinite(availableWidth) && availableWidth > 0 ? availableWidth : 760;
  // Keep enough horizontal room for a complete eighth-note measure and its signatures.
  // Small screens scroll this single canvas rather than shrinking the notation.
  return { scale, width: Math.max(440, Math.floor(width / scale)) };
}

export function getStaffBuilderReadingScrollLeft(centerX: number, availableWidth: number, contentWidth: number) {
  return Math.max(0, Math.min(Math.max(0, contentWidth - availableWidth), centerX - availableWidth * 0.55));
}
