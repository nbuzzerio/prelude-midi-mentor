import { useCallback, useState } from "react";
import { toggleRequiredSetValue } from "@/lib/toggle-required-set-value";
import type { IntervalDirection, MusicalInterval } from "@/lib/music/intervals";

const DEFAULT_INTERVALS = new Set<MusicalInterval>([
  "minor-second",
  "major-second",
  "minor-third",
  "major-third",
]);
const DEFAULT_DIRECTIONS = new Set<IntervalDirection>(["ascending"]);

export function useEarTrainingSettings() {
  const [enabledIntervals, setEnabledIntervals] = useState<ReadonlySet<MusicalInterval>>(DEFAULT_INTERVALS);
  const [enabledDirections, setEnabledDirections] = useState<ReadonlySet<IntervalDirection>>(DEFAULT_DIRECTIONS);

  const toggleInterval = useCallback((interval: MusicalInterval) => {
    setEnabledIntervals((current) => toggleRequiredSetValue(current, interval));
  }, []);
  const toggleDirection = useCallback((direction: IntervalDirection) => {
    setEnabledDirections((current) => toggleRequiredSetValue(current, direction));
  }, []);

  return { enabledDirections, enabledIntervals, toggleDirection, toggleInterval };
}
