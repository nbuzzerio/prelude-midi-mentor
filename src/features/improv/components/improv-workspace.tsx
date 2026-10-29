import { useCallback, useEffect, useRef, useState } from "react";
import { IndexedDbImprovLibrary } from "../persistence/improv-indexeddb";
import type { ImprovArchiveLibrary, ImprovCollection, ImprovLoadedTake, ImprovStoredTake } from "../improv-library";
import { ImprovLibraryError } from "../improv-library";
import { useImprovSession } from "../hooks/use-improv-session";
import { useImprovLibrary, improvErrorMessage } from "../hooks/use-improv-library";
import { useImprovReplay } from "../hooks/use-improv-replay";
import { improvMidiBlob } from "../improv-midi-export";
import { IMPROV_BACKUP_MAX_BYTES, improvBackupBlob, restoreImprovBackup } from "../improv-backup";
import { DownloadDialog } from "@/components/download-dialog";
import type { DownloadSnapshot } from "@/lib/files/browser-download";
import type { ExportDestination } from "@/lib/files/native-save";
import { recordingExtension } from "@/features/piece-practice/piece-practice-recording";
import { ImprovLiveStaff } from "./improv-live-staff";
import { ImprovLibraryView, IMPROV_BUTTON, IMPROV_SELECT } from "./improv-library-view";
import { ImprovTakeReview } from "./improv-take-review";
import { ImprovRoomAudioControls } from "./improv-room-audio-controls";
import { useImprovRoomAudio } from "../hooks/use-improv-room-audio";
import { MUSIC_KEYS, type MusicKeyId } from "@/lib/music/keys";
import type { FreeplayNotationContext } from "@/features/freeplay/freeplay-notation";

export type ImprovDepartureGuard = (proceed: () => void) => void;
export type ImprovWorkspaceProps = Readonly<{ available?: boolean; onGuardChange?: (guard: ImprovDepartureGuard | null) => void; library?: ImprovArchiveLibrary }>;

function DepartureDialog({ saving, audioPending, onStay, onSave, onLeave }: Readonly<{ saving: boolean; audioPending: boolean; onStay: () => void; onSave: () => void; onLeave: () => void }>) {
  const dialog = useRef<HTMLDialogElement>(null); const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => { const element = dialog.current; const previous = document.activeElement as HTMLElement | null;
    element?.showModal(); stay.current?.focus(); return () => { element?.close(); previous?.focus(); }; }, []);
  return <dialog ref={dialog} aria-labelledby="improv-depart-title" className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-xl border border-zinc-600 bg-zinc-950 p-5 text-white backdrop:bg-black/70" onCancel={(e) => { e.preventDefault(); if (!saving) onStay(); }}>
    <h2 className="text-xl font-bold" id="improv-depart-title">Keep this take before leaving?</h2>
    <p className="mt-3">Recording or unsaved evidence is still in this tab. Stop and save, or retry a failed save. Leaving without saving can lose the pending suffix.</p>
    {audioPending && <p className="mt-3 text-amber-200">Room audio is temporary. Stop and save MIDI, then stay to review/download audio or explicitly discard it before leaving. JSON does not include audio.</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      <button className={IMPROV_BUTTON} ref={stay} disabled={saving} onClick={onStay}>Stay in Improv</button>
      <button className={`${IMPROV_BUTTON} bg-sky-700`} disabled={saving} onClick={onSave}>{saving ? "Saving before leaving…" : "Stop / Retry Save and Leave"}</button>
      <button className={`${IMPROV_BUTTON} text-red-200`} disabled={saving} onClick={onLeave}>Leave Without Saving</button>
    </div>
  </dialog>;
}

function ActiveImprovWorkspace({ onGuardChange, library: suppliedLibrary }: ImprovWorkspaceProps) {
  const [library] = useState<ImprovArchiveLibrary>(() => suppliedLibrary ?? new IndexedDbImprovLibrary());
  const replay = useImprovReplay(); const audio = useImprovRoomAudio(!replay.playing);
  const terminal = useRef<() => void>(() => {});
  const capture = useImprovSession(library, () => { replay.stop(); audio.stop(); }, {
    onTerminal: () => terminal.current(), needsGuard: audio.controller.needsGuard,
  }); const catalog = useImprovLibrary(library);
  useEffect(() => { terminal.current = () => audio.controller.observeTerminal(capture.session.metadata()?.terminal?.boundary.observation ?? null); }, [audio.controller, capture.session]);
  const [roomRequested, setRoomRequested] = useState(false);
  const stopReplay = replay.stop; const refreshLibrary = catalog.refresh;
  const [activity, setActivity] = useState<ImprovCollection["activity"]>("first-take-sight-reading");
  const [title, setTitle] = useState(""); const [context, setContext] = useState<FreeplayNotationContext>({ type: "no-key" });
  const [take, setTake] = useState<ImprovLoadedTake | null>(null); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [download, setDownload] = useState<Readonly<{ snapshot: DownloadSnapshot; requested: (destination?: ExportDestination) => void }> | null>(null);
  const preparingBackup = useRef(false);
  const [leave, setLeave] = useState<(() => void) | null>(null); const [leavingSave, setLeavingSave] = useState(false);
  const reviewGeneration = useRef(0); const mounted = useRef(false);
  const save = capture.display.save; const unsafe = capture.session.needsGuard(); const recording = save.captureStatus === "recording";
  const phase = capture.display.phase;
  const selected = catalog.selected;
  const audioStarting = ["preparing", "starting"].includes(audio.state.phase);
  const audioProtected = audio.state.segment !== null || audio.state.phase === "finalizing";
  const busy = unsafe || catalog.busy || leavingSave || audioStarting;
  const review = useCallback(async (id: string) => {
    const token = ++reviewGeneration.current; stopReplay(); setTake(null); setError("");
    try { const loaded = await library.loadTake(id); if (mounted.current && token === reviewGeneration.current) setTake(loaded); }
    catch (failure) { if (mounted.current && token === reviewGeneration.current) setError(improvErrorMessage(failure)); }
  }, [library, stopReplay]);
  useEffect(() => { const requests = reviewGeneration; mounted.current = true; return () => { mounted.current = false; requests.current++; }; }, []);
  useEffect(() => {
    let active = true; const id = save.takeId;
    queueMicrotask(() => { if (active && save.storageStatus === "saved" && id) { void refreshLibrary(); void review(id); } });
    return () => { active = false; };
  }, [save.storageStatus, save.takeId, refreshLibrary, review]);
  useEffect(() => {
    const guard: ImprovDepartureGuard = (proceed) => {
      if (capture.session.needsGuard() || audio.controller.needsGuard()) setLeave(() => proceed);
      else { stopReplay(); proceed(); }
    };
    onGuardChange?.(guard); return () => onGuardChange?.(null);
  }, [capture.session, onGuardChange, stopReplay, audio.controller]);
  const clearReview = () => { reviewGeneration.current++; replay.stop(); capture.resetCompleted(); setTake(null); setError(""); setMessage(""); };
  const selectCollection = (id: string) => { if (unsafe || audio.controller.needsGuard()) { setError("Stay and handle or cancel temporary room audio before changing collections."); return; } clearReview(); catalog.select(id); };
  const stop = async () => { await capture.stop(); };
  const saveAndLeave = async () => {
    setLeavingSave(true); setError(""); const state = await capture.stop(); setLeavingSave(false);
    if (!mounted.current) return;
    if (state.storageStatus === "saved" && !audio.controller.needsGuard()) { replay.stop(); leave?.(); }
    else if (state.storageStatus === "saved") { setLeave(null); setError("MIDI saved. Stay to review/download room audio, then explicitly discard it before leaving."); }
    else setError("The take is not safely saved yet. Stay here and retry, or explicitly leave without saving.");
  };
  const startTake = async () => {
    const currentAudio = audio.controller.snapshot();
    if (!selected || capture.session.needsGuard() || currentAudio.segment || ["preparing", "starting", "recording", "finalizing"].includes(currentAudio.phase)) return;
    try {
      clearReview(); replay.stop();
      if (roomRequested) await audio.controller.start(() => { capture.start(selected); const metadata = capture.session.metadata()!;
        return { takeId: metadata.takeId, observation: metadata.start.observation }; });
      else capture.start(selected);
    } catch (failure) { if (mounted.current) setError(improvErrorMessage(failure)); }
    finally { if (mounted.current) setRoomRequested(false); }
  };
  const backup = async () => {
    if (!selected || preparingBackup.current || download) return;
    const collection = selected; preparingBackup.current = true;
    try {
      const evidence = await library.exportCollection(collection.collectionId);
      if (mounted.current) setDownload({ snapshot: Object.freeze({ blob: improvBackupBlob(evidence), name: collection.title,
        fallback: "improv_collection", extension: "json", format: "Improv collection JSON",
        detail: "Committed collection history. Pending in-memory events are not included." }),
        requested: (destination = "download-requested") => setMessage(`${destination === "saved" ? "Saved" : "Download requested"} for committed collection history. Pending in-memory events are not included.`) });
    } catch (failure) { if (mounted.current) setError(improvErrorMessage(failure)); }
    finally { preparingBackup.current = false; }
  };
  const restore = async (file: File) => {
    if (file.size > IMPROV_BACKUP_MAX_BYTES) { setError("This backup exceeds the 64 MiB limit. Nothing was imported."); return; }
    await catalog.act(async () => {
      const json = await file.text(); const restored = await restoreImprovBackup(library, json);
      if (!mounted.current) return; clearReview(); catalog.select(restored.collectionId); setActivity(restored.activity);
      setMessage("Backup restored as a separate collection. Existing histories were not overwritten.");
    });
  };
  const downloadMidi = () => {
    if (!take) return;
    try { const { blob, report } = improvMidiBlob(take);
      setDownload({ snapshot: Object.freeze({ blob, name: selected?.title ?? "improv", fallback: "improv", extension: "mid", format: "MIDI file",
        detail: `Take ${take.record.number}. This MIDI projection is not the full raw evidence.` }),
        requested: (destination = "download-requested") => setMessage(`${destination === "saved" ? "Saved" : "Download requested"}: ${report.omitted.length} messages omitted; ${report.generated.length} generated cleanup messages. This projection is not the full raw evidence.`) }); }
    catch (failure) { setError(improvErrorMessage(failure)); }
  };
  const downloadRoomAudio = () => {
    const segment = audio.controller.snapshot().segment;
    if (!segment) return;
    const extension = recordingExtension(segment.mimeType);
    if (extension !== "webm" && extension !== "m4a" && extension !== "ogg") { setError("Unknown recording container. Temporary audio is retained."); return; }
    const number = capture.session.state().number;
    setDownload({ snapshot: Object.freeze({ blob: segment.blob, name: selected?.title ?? "improv", fallback: "improv_audio",
      extension, format: "Room microphone audio", detail: number === null ? "Take number pending. Original microphone recording." : `Take ${number}. Original microphone recording.` }),
      requested: (destination = "download-requested") => { audio.controller.acknowledgeDownloadRequest(segment, destination); setMessage(destination === "saved" ? "Saved. Temporary audio remains until you explicitly discard it." : "Download requested. Verify the recording before explicitly discarding temporary audio."); } });
  };
  const deleteTake = (item: ImprovStoredTake) => {
    if (!window.confirm(`Delete Take ${item.number} from "${selected?.title}"? Its MIDI evidence will be removed. Numbers and the original-first identity are not reused.`)) return;
    clearReview(); void catalog.act(() => library.deleteTake(item.takeId, { takeId: item.takeId, revision: item.revision, confirmed: true }));
  };
  const status = save.storageStatus === "saved" ? save.captureStatus === "interrupted" ? "Interrupted · captured prefix saved locally" : "Saved locally"
    : save.storageStatus === "failed" ? "Save failed · pending evidence retained in this tab"
    : recording ? `${phase === "paused" ? "Paused" : phase === "pausing" ? "Pausing…" : phase === "resuming" ? "Resuming…" : "Recording"} · local checkpoints active`
    : save.storageStatus === "idle" ? "Ready" : "Saving · wait for local acknowledgment";
  return <section className="improv-workspace mx-auto min-w-0 max-w-7xl text-white" aria-labelledby="improv-title">
    <header className="mb-3 flex flex-wrap items-center gap-2"><h1 className="mr-auto text-2xl font-bold" id="improv-title">Improv</h1>{!recording && <span className="text-sm text-zinc-400">Play first. Explore details second.</span>}</header>
    {recording ? <p className="mb-3 break-words text-sm text-zinc-300">{activity === "first-take-sight-reading" ? "First-Take Sight-Reading" : "Free Improvisation"} · {selected?.title}</p> : <div className="mb-3 grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="min-w-0 text-sm">Activity<select className={IMPROV_SELECT} value={activity} disabled={busy || audioProtected || audio.state.phase === "ready"} onChange={(e) => { setActivity(e.target.value as ImprovCollection["activity"]); selectCollection(""); }}>
        <option value="first-take-sight-reading">First-Take Sight-Reading</option><option value="free-improvisation">Free Improvisation</option>
      </select></label>
      <label className="min-w-0 text-sm">{activity === "first-take-sight-reading" ? "Piece" : "Improvisation session"}<select className={IMPROV_SELECT} value={catalog.selectedId} disabled={busy || audioProtected || audio.state.phase === "ready"} onChange={(e) => selectCollection(e.target.value)}>
        <option value="">Create or choose a collection</option>{catalog.collections.filter((c) => c.activity === activity).map((c) => <option key={c.collectionId} value={c.collectionId}>{c.title}</option>)}
      </select></label>
    </div>}
    {!recording && (!selected ? <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void catalog.create(title, activity); }}>
      <label className="min-w-0 flex-1 text-sm">{activity === "first-take-sight-reading" ? "New piece title" : "New session title"}<input className={IMPROV_SELECT} value={title} maxLength={256} disabled={busy} onChange={(e) => setTitle(e.target.value)} placeholder={activity === "first-take-sight-reading" ? "Disney Songbook — Bells of Notre Dame" : "Evening ideas"} /></label>
      <button className={IMPROV_BUTTON} disabled={busy}>Create collection</button>
    </form> : <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="min-w-0 flex-1 break-words text-lg font-semibold">{selected.title}</h2><button className={IMPROV_BUTTON} disabled={busy || audioProtected || audio.state.phase === "ready"} onClick={() => selectCollection("")}>New collection</button></div>)}
    <div className="improv-playing grid min-w-0 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="order-2 min-w-0 lg:order-1"><ImprovLiveStaff pitches={capture.display.pitches} context={context} source={capture.session.timeline} /></div>
      <div className="order-1 min-w-0 rounded-xl border border-white/10 bg-white/5 p-4 lg:order-2">
        {recording ? <p className="break-words text-sm">Physical MIDI input: <strong>{capture.selectedInput?.name ?? "Selected input unavailable"}</strong></p> : <label className="block text-sm">Physical MIDI input<select className={IMPROV_SELECT} value={capture.selectedInputId} disabled={unsafe} onChange={(e) => capture.selectInput(e.target.value)}>
          <option value="">Select a physical input</option>{capture.selectedInputId && !capture.selectedInput && <option value={capture.selectedInputId}>Selected source disconnected</option>}
          {capture.midi.connectedInputs.filter((i) => i.id).map((i) => <option value={i.id!} key={i.id}>{i.name ?? "Unnamed physical MIDI input"}</option>)}
        </select></label>}
        <div className="mt-2 flex flex-wrap items-center gap-2">{!recording && <button className={IMPROV_BUTTON} disabled={unsafe || capture.midi.status === "connecting"} onClick={() => void capture.midi.connectMidi()}>Connect MIDI</button>}<span className="text-sm text-zinc-300">{capture.selectedInput ? "Selected input connected" : "Selected input unavailable"}</span></div>
        {!capture.ownerActive && <p className="mt-2 text-amber-200">Another activity owns MIDI. Finish it and reopen Improv.</p>}
        {capture.midi.connectedInputs.some((input) => !input.id) && <p className="mt-2 text-amber-200">Some connected inputs have no usable browser identity and cannot be selected for Improv capture.</p>}
        {capture.midi.error && <p role="alert" className="mt-2 text-red-200">{capture.midi.error}</p>}
        <div className="my-3 flex items-center justify-between gap-2"><span className="text-sm">{save.number === null ? save.takeId ? "Take number pending" : "No active take" : `Take ${save.number}${save.number === 1 ? " · Original first attempt" : ""}`}</span>
          <span className="font-mono text-3xl tabular-nums" aria-label="Musical elapsed time" aria-live="off">{String(Math.floor(capture.display.elapsedSeconds / 60)).padStart(2, "0")}:{String(capture.display.elapsedSeconds % 60).padStart(2, "0")}</span></div>
        {recording ? <div className="flex flex-wrap gap-2">
          <button className={`${IMPROV_BUTTON} min-w-0 flex-1 border-sky-400 text-lg`}
            disabled={phase === "pausing" || phase === "resuming" || (phase === "paused" && Boolean(save.failure || save.pendingControlCount)) || (phase === "recording" && audio.controller.active() && !audio.controller.canPause())}
            onClick={() => void (phase === "paused" ? capture.resume(audio.controller) : capture.pause(audio.controller))}>
            {phase === "paused" ? "Resume" : phase === "pausing" ? "Pausing…" : phase === "resuming" ? "Resuming…" : "Pause"}</button>
          <button className={`${IMPROV_BUTTON} min-w-0 flex-1 border-red-400 bg-red-700 text-lg`} onClick={() => void stop()}>Stop Take</button>
        </div>
          : <button className={`${IMPROV_BUTTON} w-full border-sky-400 bg-sky-700 text-xl`} disabled={busy || audioProtected || !selected || !capture.selectedInput || !capture.ownerActive || replay.playing || (roomRequested && audio.state.phase !== "ready")} onClick={() => void startTake()}>Start Take</button>}
        <p role="status" className="mt-3 font-semibold" aria-live="polite">{status}</p>
        {recording && <p className="mt-2 text-xs text-zinc-400">Pauses freeze musical time. Paused MIDI stays in JSON evidence, outside the staff and replay. Resume keeps this take.</p>}
        {recording && audio.controller.active() && !audio.controller.canPause() && <p className="mt-2 text-amber-200">This browser recorder does not support coordinated Pause/Resume. Stop Take remains available.</p>}
        {capture.display.transitionError && <p role="alert" className="mt-2 text-amber-200">{capture.display.transitionError}</p>}
        {save.failure && <p role="alert" className="mt-2 text-red-200">{improvErrorMessage(new ImprovLibraryError(save.failure))}</p>}
        {save.captureFailure && <p role="alert" className="mt-2 text-amber-200">Capture ended at the unsaved-data limit. The retained prefix remains available; later events were not recorded.</p>}
        {save.storageStatus === "failed" && <button className={`${IMPROV_BUTTON} mt-2 w-full`} onClick={() => void capture.retry()}>Retry Save</button>}
        {unsafe && <p className="mt-2 text-xs text-amber-200">Pending evidence may be lost on navigation or browser termination. Wait for confirmed local save.</p>}
        {!recording && <p className="mt-3 text-xs text-zinc-400">{activity === "first-take-sight-reading" ? "Read from your physical book. No entered score or accuracy grading is required." : "Explore freely. Every delivered event is preserved, including notes outside the display key."}</p>}
      </div>
    </div>
    {!recording && !audioProtected && <div className="mt-3 text-sm">
      <label className="flex items-center gap-2"><input type="checkbox" checked={roomRequested} disabled={unsafe || audioStarting || replay.playing} onChange={e => { setRoomRequested(e.target.checked); if (!e.target.checked) audio.controller.discard(); }} />Record room audio with this take</label>
      {roomRequested && <div className="mt-2">
        <p>Records sound from your microphone. Audio is temporary until downloaded and is not included in the MIDI or JSON backup.</p>
        <button className={`${IMPROV_BUTTON} mt-2`} disabled={audioStarting || audio.state.phase === "ready" || !selected || !capture.selectedInput || !capture.ownerActive || replay.playing} onClick={() => void audio.controller.prepare()}>Prepare room microphone</button>
        <button className={`${IMPROV_BUTTON} ml-2 mt-2`} onClick={() => { audio.controller.discard(); setRoomRequested(false); }}>Use MIDI only / Cancel audio</button>
      </div>}
    </div>}
    {audio.state.phase !== "disabled" && audio.state.phase !== "discarded" && <p role={audio.state.phase === "failed" ? "alert" : "status"} className="mt-2 text-sm text-zinc-300">{audio.state.message}</p>}
    {audioProtected && <p className="mt-2 text-sm text-amber-200">Review/download or explicitly discard temporary audio before starting another take, changing collections or deleting takes.</p>}
    <ImprovRoomAudioControls state={audio.state} onDownload={downloadRoomAudio}
      onDiscard={() => { if (window.confirm("Discard this temporary room recording? MIDI remains in the local library.")) audio.controller.discard(); }} />
    {(error || catalog.error) && <p role="alert" className="my-3 rounded-lg bg-red-950 p-3 text-red-100">{error || catalog.error}</p>}
    {message && <p role="status" className="my-3 text-sm text-zinc-300">{message}</p>}
    <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
      <ImprovTakeReview take={take} context={context} playing={replay.playing} transport={replay.transport} disabled={recording || busy || audio.controller.needsGuard()} error={replay.error} onPlay={(range) => { if (take && !audio.controller.needsGuard()) replay.play(take, range); }} onStop={replay.stop} onMidi={downloadMidi} />
      <ImprovLibraryView collection={selected} takes={catalog.takes} disabled={busy || audioProtected || audio.state.phase === "ready"} onReview={(item) => void review(item.takeId)} onRefresh={() => void catalog.refresh()}
        onRecover={(item) => void catalog.act(async () => { await library.recoverTake(item.takeId); await review(item.takeId); })}
        onRename={(value) => { if (selected) void catalog.act(() => library.renameCollection(selected.collectionId, value.trim(), selected.revision)); }} onDeleteTake={deleteTake}
        onDeleteCollection={() => { if (!selected || !window.confirm(`Delete collection "${selected.title}" and all its takes? This removes their MIDI evidence from this browser.`)) return; clearReview(); void catalog.act(() => library.deleteCollection(selected.collectionId, { collectionId: selected.collectionId, revision: selected.revision, confirmed: true })); }} />
      <details className="rounded-xl border border-white/10 bg-white/5 p-3"><summary className="cursor-pointer py-2 font-semibold">Notation context</summary>
        <label className="mt-3 block text-sm">Display key<select className={IMPROV_SELECT} value={context.type === "key" ? context.keyId : "no-key"} onChange={(e) => setContext(e.target.value === "no-key" ? { type: "no-key" } : { type: "key", keyId: e.target.value as MusicKeyId })}>
          <option value="no-key">No key</option>{MUSIC_KEYS.map((key) => <option key={key.id} value={key.id}>{key.name}</option>)}
        </select></label><p className="mt-2 text-xs text-zinc-400">Display spelling only; no correction, transposition or quantization of captured MIDI.</p>
      </details>
      <details className="rounded-xl border border-white/10 bg-white/5 p-3"><summary className="cursor-pointer py-2 font-semibold">JSON backup and restore</summary>
        <p className="mt-2 text-sm text-zinc-300">JSON keeps committed collection evidence, original numbering and deleted-take history. It does not include a pending unsaved suffix. Restore creates a separate collection.</p>
        <button className={`${IMPROV_BUTTON} my-3`} disabled={!selected || busy} onClick={() => void backup()}>Download JSON backup</button>
        <label className="block text-sm">Restore JSON backup<input className="mt-2 block w-full min-w-0 text-sm" type="file" accept=".json,application/json" disabled={busy || audioProtected || audio.state.phase === "ready"} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void restore(file); }} /></label>
      </details>
    </div>
    {leave && <DepartureDialog saving={leavingSave} audioPending={audio.controller.needsGuard()} onStay={() => setLeave(null)} onSave={() => void saveAndLeave()} onLeave={() => { replay.stop(); audio.controller.discard(); leave(); }} />}
    {download && <DownloadDialog snapshot={download.snapshot} onCancel={() => setDownload(null)} onRequested={() => { download.requested(); setDownload(null); }} onSaved={() => { download.requested("saved"); setDownload(null); }} />}
  </section>;
}

export default function ImprovWorkspace(props: ImprovWorkspaceProps) {
  return props.available === false ? <section className="mx-auto max-w-7xl rounded-xl border border-amber-400/30 p-5 text-white"><h1 className="text-2xl font-bold">Improv</h1><p className="mt-3">Finish or end the active Practice Session before opening Improv. Its MIDI input remains with that session.</p></section> : <ActiveImprovWorkspace {...props} />;
}
