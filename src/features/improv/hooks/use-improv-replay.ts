import { useCallback, useEffect, useRef, useState } from "react";
import { createImprovReplay, type ImprovReplayTransport } from "../improv-replay";
import { createImprovPianoVoices } from "../improv-piano-voices";
import type { ImprovLoadedTake } from "../improv-library";

export function useImprovReplay() {
  const engine = useRef<ReturnType<typeof createImprovReplay> | null>(null); const generation = useRef(0);
  const [playing, setPlaying] = useState(false); const [error, setError] = useState("");
  const [transport, setTransport] = useState<ImprovReplayTransport | null>(null);
  const stop = useCallback(() => { generation.current++; engine.current?.dispose(); engine.current = null; setPlaying(false); }, []);
  useEffect(() => () => { generation.current++; engine.current?.dispose(); engine.current = null; }, []);
  const play = (take: ImprovLoadedTake) => {
    stop(); const token = generation.current; setError("");
    try {
      engine.current = createImprovReplay(createImprovPianoVoices()); const run = engine.current.play(take); setTransport(run.transport); setPlaying(true);
      void run.completion.then((result) => {
        if (generation.current !== token) return;
        setPlaying(false); engine.current?.dispose(); engine.current = null;
        if (result === "failed") setError("Piano replay could not continue. Check browser audio permissions and try again.");
      });
    } catch { stop(); setError("Piano replay is unavailable. Try again after interacting with the page."); }
  };
  return { play, stop, playing, error, transport };
}
