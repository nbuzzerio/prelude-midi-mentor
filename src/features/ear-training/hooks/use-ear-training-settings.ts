import { DEFAULT_EAR_TRAINING_CONFIG, earTrainingConfigToSettings, type EarTrainingConfig } from "../ear-training-config";
import { useCallback, useState } from "react";
import { toggleRequiredSetValue } from "@/lib/toggle-required-set-value";
import type { IntervalDirection, MusicalInterval } from "@/lib/music/intervals";

export function useEarTrainingSettings(initialConfig: EarTrainingConfig = DEFAULT_EAR_TRAINING_CONFIG) {
  const [initial] = useState(() => earTrainingConfigToSettings(initialConfig));
  const [enabledIntervals, setEnabledIntervals] = useState<ReadonlySet<MusicalInterval>>(initial.enabledIntervals);
  const [enabledDirections, setEnabledDirections] = useState<ReadonlySet<IntervalDirection>>(initial.enabledDirections);

  const toggleInterval = useCallback((interval: MusicalInterval) => {
    setEnabledIntervals((current) => toggleRequiredSetValue(current, interval));
  }, []);
  const toggleDirection = useCallback((direction: IntervalDirection) => {
    setEnabledDirections((current) => toggleRequiredSetValue(current, direction));
  }, []);

  return { enabledDirections, enabledIntervals, toggleDirection, toggleInterval };
}
