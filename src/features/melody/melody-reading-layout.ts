/** Presentation only. Neither layout nor following can change an expected onset. */
export function getMelodyReadingLayout(availableWidth: number, paired: boolean, expanded: boolean) {
  const viewportWidth = Number.isFinite(availableWidth) && availableWidth > 0 ? availableWidth : 760;
  // Preserve piano-distance notation on laptops; phones use a deliberate readable
  // floor instead of scaling an entire wide measure down to fit.
  const scale = viewportWidth < 360 ? 1.4 : viewportWidth < 640 ? 1.6 : !paired && expanded ? 2.2 : 1.8;
  return { scale, width: Math.floor(viewportWidth / scale) };
}

/** The opening position stays still when the first note becomes due. */
export function getMelodyReadingScrollLeft(cursorX: number, openingX: number, viewportWidth: number, contentWidth: number) {
  const followingPosition = Math.max(openingX, viewportWidth * 0.35);
  return Math.max(0, Math.min(Math.max(0, contentWidth - viewportWidth), cursorX - followingPosition));
}
