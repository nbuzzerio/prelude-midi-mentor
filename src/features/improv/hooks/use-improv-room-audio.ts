import { useCallback, useEffect, useRef, useState } from "react";
import { createImprovRoomAudio } from "../improv-room-audio";

export function useImprovRoomAudio(eligible: boolean) {
  const [eligibility] = useState(() => { let allowed = eligible; return { current: () => allowed, update: (value: boolean) => { allowed = value; } }; });
  const lifetime = useRef(0);
  useEffect(() => { eligibility.update(eligible); }, [eligible, eligibility]);
  const [controller] = useState(() => createImprovRoomAudio({ eligible: () => eligibility.current() && document.visibilityState !== "hidden" }));
  const [state, setState] = useState(controller.snapshot);
  // The controller owns audio; React observes a bounded state snapshot at ten Hz.
  useEffect(() => {
    const owners = lifetime; owners.current++;
    const timer = setInterval(() => setState(previous => previous === controller.snapshot() ? previous : controller.snapshot()), 100);
    return () => { clearInterval(timer); owners.current--; queueMicrotask(() => { if (!owners.current) controller.dispose(); }); };
  }, [controller]);
  const stop = useCallback(() => controller.stop(), [controller]);
  return { controller, state, stop };
}
