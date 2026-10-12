import { downloadFilename, type DownloadExtension } from "@/lib/files/download-filename";
export { requestBrowserDownload as downloadImprovBlob } from "@/lib/files/browser-download";

export function improvFilename(title: string, extension: DownloadExtension): string {
  return downloadFilename(title, extension, "improv");
}
