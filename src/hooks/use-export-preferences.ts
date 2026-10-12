import { useLayoutEffect, useSyncExternalStore } from "react";
import { exportPreferences, type ExportPreferences } from "@/lib/files/export-preferences";

export function useExportPreferences(store: ExportPreferences = exportPreferences) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useLayoutEffect(() => { void store.load(); }, [store]);
  return { state, store };
}
