/** Initiates a native download; this does not acknowledge that the user retained the file. */
export function downloadImprovBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | undefined; let initiated = false;
  try {
    anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
    document.body.append(anchor); anchor.click(); initiated = true;
  } finally {
    anchor?.remove();
    // Let the browser consume the URL. Cleanup belongs to the download, not a mounted workspace.
    if (initiated) setTimeout(() => URL.revokeObjectURL(url), 1000);
    else URL.revokeObjectURL(url);
  }
}
export function improvFilename(title: string, suffix: string): string {
  return `prelude-${title.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 80) || "improv"}-${suffix}`;
}
