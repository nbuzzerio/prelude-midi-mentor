import { useCallback, useEffect, useRef, useState } from "react";
import { ImprovLibraryError, type ImprovArchiveLibrary, type ImprovCollection, type ImprovDeletedTake, type ImprovStoredTake } from "../improv-library";

export function improvErrorMessage(error: unknown): string {
  if (!(error instanceof ImprovLibraryError)) return error instanceof Error ? error.message : "The operation failed. Your existing evidence has not been replaced.";
  const messages: Record<ImprovLibraryError["reason"], string> = {
    unavailable: "Local storage is unavailable. Check browser permissions or private browsing settings.", blocked: "Another Prelude tab is blocking local storage. Close it and retry.",
    closed: "This library session has closed. Reopen Improv.", "write-failed": "Local save failed. Pending evidence remains in this tab; retry before leaving.",
    quota: "Browser storage is full. Pending evidence remains in this tab. Make room and retry; Prelude will not delete older takes.",
    corrupt: "This evidence is invalid or corrupt. It was not imported or replaced.", unsupported: "This file or stored format is not supported by this version of Prelude.",
    "not-found": "That collection or take has been deleted. Refresh the library.", collision: "The destination identity already exists. Nothing was overwritten; retry to create a separate history.",
    limit: "The file or library exceeds a supported size limit. Nothing was silently removed.", stale: "Another tab changed this item. Refresh and retry.",
    owned: "Another capture owns this take. End that capture or return later to recover its saved prefix.", "lease-expired": "Capture ownership expired. This take cannot resume; recover its saved prefix.",
    "clock-regressed": "The system clock changed. Capture has stopped; retry saving the retained evidence.", "confirmation-required": "Explicit deletion confirmation is required.",
  };
  return messages[error.reason];
}

export function useImprovLibrary(library: ImprovArchiveLibrary) {
  const [collections, setCollections] = useState<readonly ImprovCollection[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [takes, setTakes] = useState<readonly (ImprovStoredTake | ImprovDeletedTake)[]>([]);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const generation = useRef(0); const selectedRef = useRef(""); const mounted = useRef(false);
  const refresh = useCallback(async (wanted = selectedRef.current) => {
    const token = ++generation.current; setBusy(true);
    try {
      const all: ImprovCollection[] = []; let after = "";
      while (true) { const page = await library.listCollections(after, 100); all.push(...page); if (page.length < 100) break; after = page.at(-1)!.collectionId; }
      const id = all.some((c) => c.collectionId === wanted) ? wanted : "";
      const rows: (ImprovStoredTake | ImprovDeletedTake)[] = []; let afterNumber = 0;
      if (id) while (true) { const page = await library.listTakes(id, afterNumber, 100); rows.push(...page); if (page.length < 100) break; afterNumber = page.at(-1)!.number; }
      if (!mounted.current || token !== generation.current) return;
      selectedRef.current = id; setCollections(all); setSelectedId(id); setTakes(rows); setError("");
    } catch (failure) { if (mounted.current && token === generation.current) setError(improvErrorMessage(failure)); }
    finally { if (mounted.current && token === generation.current) setBusy(false); }
  }, [library]);
  useEffect(() => {
    const requestGeneration = generation;
    let active = true; mounted.current = true;
    queueMicrotask(() => { if (active) void refresh(); });
    return () => { active = false; mounted.current = false; requestGeneration.current++; };
  }, [refresh]);
  const select = (id: string) => { selectedRef.current = id; setSelectedId(id); setTakes([]); void refresh(id); };
  const act = async (operation: () => Promise<unknown>) => {
    if (busy) return; setBusy(true);
    try { await operation(); if (mounted.current) await refresh(); }
    catch (failure) { if (mounted.current) setError(improvErrorMessage(failure)); }
    finally { if (mounted.current) setBusy(false); }
  };
  const create = async (title: string, activity: ImprovCollection["activity"]) => {
    await act(async () => { const item = await library.createCollection(crypto.randomUUID(), title.trim() || (activity === "free-improvisation" ? "Untitled improvisation" : "Untitled piece"), activity); selectedRef.current = item.collectionId; });
  };
  return { collections, selectedId, selected: collections.find((c) => c.collectionId === selectedId) ?? null, takes, error, busy, refresh, select, act, create };
}
