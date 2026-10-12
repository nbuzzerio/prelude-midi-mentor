import type { DownloadExtension } from "./download-filename";

/** Blob contents are immutable. Filename edits are independent of source evidence. */
export type DownloadSnapshot = Readonly<{
  blob: Blob;
  name: string;
  fallback: string;
  extension: DownloadExtension;
  format: string;
  detail?: string;
}>;

/** Requests a normal browser download, without claiming completion or writing a path. */
export function requestBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | undefined, initiated = false;
  try {
    anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.hidden = true;
    document.body.append(anchor); anchor.click(); initiated = true;
  } finally {
    anchor?.remove();
    // Delivery owns cleanup, including after the initiating dialog/feature unmounts.
    if (initiated) setTimeout(() => URL.revokeObjectURL(url), 1000);
    else URL.revokeObjectURL(url);
  }
}
