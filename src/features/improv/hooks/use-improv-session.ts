import { useCallback, useEffect, useRef, useState } from "react";
import { useAppMidiInput } from "@/hooks/use-app-midi-input";
import { createImprovWorkspaceSession, type ImprovAudioTransition } from "../improv-workspace-session";
import type { ImprovArchiveLibrary, ImprovCollection } from "../improv-library";
import type { ImprovCaptureContext } from "../improv-take";

const createId = () => crypto.randomUUID();
function captureClock(initial: ImprovCaptureContext) {
  let context = initial;
  return { current: () => context, renewOwner: () => { context = { ...context, ownerId: createId() }; },
    observe: () => ({ atMs: performance.now(), context }) };
}
export function useImprovSession(library: ImprovArchiveLibrary, onBackground: () => void,
  audio?: Readonly<{ onTerminal: () => void; needsGuard: () => boolean }>) {
  const [initialContext] = useState(() => ({ ownerId: createId(), clockId: createId(), timeOriginMs: performance.timeOrigin ?? null }));
  const [clock] = useState(() => captureClock(initialContext)); const ownerRef = useRef(false); const availability = useRef(new Map<string, boolean>());
  const [session] = useState(() => createImprovWorkspaceSession({ library, createId,
    observe: clock.observe }));
  const [selectedInputId, setSelectedInputId] = useState("");
  const [ownerActive, setOwnerActive] = useState(false);
  const [display, setDisplay] = useState(() => ({ save: session.state(), phase: session.phase(), transitionError: "", pitches: [] as number[], elapsedSeconds: 0, heldVersion: -1 }));
  const lifetime = useRef(0); const backgroundRef = useRef(onBackground);
  const audioRef = useRef(audio);
  const notifiedTerminal = useRef<string | null>(null);
  useEffect(() => { audioRef.current = audio; }, [audio]);
  useEffect(() => { backgroundRef.current = onBackground; }, [onBackground]);
  const sync = useCallback(() => {
    const save = session.state(); const phase = session.phase(), transitionError = session.transitionError();
    if ((save.captureStatus === "completed" || save.captureStatus === "interrupted") && save.takeId !== notifiedTerminal.current) {
      notifiedTerminal.current = save.takeId; audioRef.current?.onTerminal();
    }
    const elapsed = Math.floor((session.timeline()?.elapsed(performance.now()) ?? 0) / 1000);
    const elapsedSeconds = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    const heldVersion = session.heldVersion();
    setDisplay((previous) => JSON.stringify(previous.save) === JSON.stringify(save) && previous.phase === phase && previous.transitionError === transitionError && previous.heldVersion === heldVersion && previous.elapsedSeconds === elapsedSeconds
      ? previous : { save, phase, transitionError, pitches: heldVersion === previous.heldVersion ? previous.pitches : session.heldPitches(), elapsedSeconds, heldVersion });
  }, [session]);
  const midi = useAppMidiInput({
    rawInputId: selectedInputId,
    onRawMessage: (message) => { const wasRecording = session.state().captureStatus === "recording"; session.append(message, clock.current()); if (wasRecording && session.state().captureStatus !== "recording") audioRef.current?.onTerminal(); },
    onInputConnectionChange: (change) => { if (change.input.id) availability.current.set(change.input.id, change.state === "connected"); session.connection(change, clock.current()); if (change.state === "disconnected" && change.input.id === selectedInputId) audioRef.current?.onTerminal(); },
    onOwnershipChange: (active) => {
      ownerRef.current = active;
      if (active) clock.renewOwner();
      else if (session.state().captureStatus === "recording") void session.interrupt("consumer-lost");
      if (!active) audioRef.current?.onTerminal();
      setOwnerActive(active);
    },
  });
  const selectedInput = midi.connectedInputs.find((input) => input.id && input.id === selectedInputId) ?? null;
  useEffect(() => {
    const lifetimeCounter = lifetime;
    lifetime.current++;
    const tick = window.setInterval(sync, 100); // At most ten display commits/second; no raw history in React.
    const interrupt = (reason: "background" | "freeze" | "pagehide") => {
      backgroundRef.current();
      if (session.state().captureStatus === "recording") void session.interrupt(reason).then(sync);
      sync();
    };
    const hidden = () => { if (document.visibilityState === "hidden") interrupt("background"); };
    const freeze = () => interrupt("freeze"); const pagehide = () => interrupt("pagehide");
    const unload = (event: BeforeUnloadEvent) => {
      if (session.needsGuard() || audioRef.current?.needsGuard()) { event.preventDefault(); event.returnValue = ""; }
    };
    document.addEventListener("visibilitychange", hidden); document.addEventListener("freeze", freeze);
    window.addEventListener("pagehide", pagehide); window.addEventListener("beforeunload", unload);
    return () => {
      clearInterval(tick); document.removeEventListener("visibilitychange", hidden); document.removeEventListener("freeze", freeze);
      window.removeEventListener("pagehide", pagehide); window.removeEventListener("beforeunload", unload);
      lifetimeCounter.current--;
      // Strict Mode's immediate setup reuses the same owner. Real departure finalizes before closing IDB.
      queueMicrotask(() => { if (!lifetimeCounter.current) { void session.dispose().finally(() => library.close()); } });
    };
  }, [library, session, sync]);
  const selectInput = (id: string) => { if (session.needsGuard()) return; session.selectInput(id); setSelectedInputId(id); sync(); };
  const start = (collection: ImprovCollection) => {
    // Consult the current connected-source snapshot immediately before explicit Start; no fallback.
    const input = midi.connectedInputs.find((item) => item.id && item.id === selectedInputId);
    if (!ownerRef.current || !input || availability.current.get(selectedInputId) === false || document.visibilityState === "hidden") throw new Error("Select an available physical MIDI input in the foreground before starting.");
    session.start(collection, input, clock.current()); sync();
  };
  const stop = async () => { const pending = session.stop(); audioRef.current?.onTerminal(); sync(); const state = await pending; sync(); return state; };
  const validateResume = () => {
    if (!ownerRef.current || !selectedInput || availability.current.get(selectedInputId) === false || document.visibilityState === "hidden") throw new Error("Resume requires the selected physical MIDI input, ownership and foreground capture.");
  };
  const pause = async (room?: ImprovAudioTransition) => { const pending = session.pause(room); sync(); await pending; sync(); };
  const resume = async (room?: ImprovAudioTransition) => { const pending = session.resume(validateResume, room); sync(); await pending; sync(); };
  const retry = async () => { const pending = session.retry(); sync(); const state = await pending; sync(); return state; };
  const resetCompleted = () => { session.resetCompleted(); sync(); };
  return { midi, selectedInputId, selectedInput, ownerActive, selectInput, session, display, start, stop, pause, resume, retry, resetCompleted };
}
