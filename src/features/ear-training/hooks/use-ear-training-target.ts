import { useCallback, useRef, useState } from "react";
import type { IntervalDirection, MusicalInterval } from "@/lib/music/intervals";
import { generateEarTrainingTarget } from "../generate-ear-training-target";

type Options = Readonly<{
  enabledDirections: ReadonlySet<IntervalDirection>;
  enabledIntervals: ReadonlySet<MusicalInterval>;
}>;

export function useEarTrainingTarget(options: Options) {
  const [target, setTarget] = useState(() => generateEarTrainingTarget(options));
  const targetRef = useRef(target);
  const lockedRef = useRef(false);

  const generateNextTarget = useCallback(() => {
    const next = generateEarTrainingTarget(options);
    targetRef.current = next;
    lockedRef.current = false;
    setTarget(next);
  }, [options]);

  const lockTarget = useCallback(() => {
    if (lockedRef.current) return false;
    lockedRef.current = true;
    return true;
  }, []);

  return {
    generateNextTarget,
    getCurrentTarget: useCallback(() => targetRef.current, []),
    isTargetLocked: useCallback(() => lockedRef.current, []),
    lockTarget,
    target,
  };
}
