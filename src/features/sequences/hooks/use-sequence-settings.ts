import { DEFAULT_SEQUENCE_CONFIG, sequenceConfigToSettings, type SequenceConfig, hasCompatibleProgressionSelection } from "../sequence-config";
import { useCallback, useState } from "react";

import { toggleRequiredSetValue } from "@/lib/toggle-required-set-value";
import type {
  ChordProgressionKeyId,
  ChordProgressionTemplateId,
} from "@/lib/music/chord-progressions";

import type {
  PracticeClefMode,
  SequenceArpeggio,
  SequenceArpeggioDirection,
  SequenceDirection,
  SequenceExerciseType,
  SequenceInterval,
  SequenceNoteCategory,
  SequenceScale,
  SequenceScaleDirection,
} from "@/types/practice";


export function useSequenceSettings(initialConfig: SequenceConfig = DEFAULT_SEQUENCE_CONFIG) {
  const [initial] = useState(() => sequenceConfigToSettings(initialConfig));
  const [exerciseType, setExerciseType] =
    useState<SequenceExerciseType>(initial.exerciseType);

  const [mode, setMode] = useState<PracticeClefMode>(initial.mode);

  const [showTargetName, setShowTargetName] = useState(initial.showTargetName);

  const [enabledDirections, setEnabledDirections] = useState<
    ReadonlySet<SequenceDirection>
  >(initial.enabledDirections);

  const [enabledIntervals, setEnabledIntervals] = useState<
    ReadonlySet<SequenceInterval>
  >(initial.enabledIntervals);

  const [enabledNoteCategories, setEnabledNoteCategories] = useState<
    ReadonlySet<SequenceNoteCategory>
  >(initial.enabledNoteCategories);

  const [enabledScales, setEnabledScales] = useState<
    ReadonlySet<SequenceScale>
  >(initial.enabledScales);

  const [enabledScaleDirections, setEnabledScaleDirections] = useState<
    ReadonlySet<SequenceScaleDirection>
  >(initial.enabledScaleDirections);

  const [enabledArpeggios, setEnabledArpeggios] = useState<
    ReadonlySet<SequenceArpeggio>
  >(initial.enabledArpeggios);
  const [enabledArpeggioDirections, setEnabledArpeggioDirections] = useState<
    ReadonlySet<SequenceArpeggioDirection>
  >(initial.enabledArpeggioDirections);

  const [enabledChordProgressionKeyIds, setEnabledChordProgressionKeyIds] =
    useState<ReadonlySet<ChordProgressionKeyId>>(initial.enabledChordProgressionKeyIds);

  const [
    enabledChordProgressionTemplateIds,
    setEnabledChordProgressionTemplateIds,
  ] = useState<ReadonlySet<ChordProgressionTemplateId>>(initial.enabledChordProgressionTemplateIds);

  const toggleDirection = useCallback((direction: SequenceDirection) => {
    setEnabledDirections((currentDirections) =>
      toggleRequiredSetValue(currentDirections, direction),
    );
  }, []);

  const toggleInterval = useCallback((interval: SequenceInterval) => {
    setEnabledIntervals((currentIntervals) =>
      toggleRequiredSetValue(currentIntervals, interval),
    );
  }, []);

  const toggleNoteCategory = useCallback((category: SequenceNoteCategory) => {
    setEnabledNoteCategories((currentCategories) =>
      toggleRequiredSetValue(currentCategories, category),
    );
  }, []);

  const toggleScale = useCallback((scale: SequenceScale) => {
    setEnabledScales((currentScales) =>
      toggleRequiredSetValue(currentScales, scale),
    );
  }, []);

  const toggleScaleDirection = useCallback(
    (direction: SequenceScaleDirection) => {
      setEnabledScaleDirections((currentDirections) =>
        toggleRequiredSetValue(currentDirections, direction),
      );
    },
    [],
  );

  const toggleArpeggio = useCallback((arpeggio: SequenceArpeggio) => {
    setEnabledArpeggios((currentArpeggios) =>
      toggleRequiredSetValue(currentArpeggios, arpeggio),
    );
  }, []);

  const toggleArpeggioDirection = useCallback(
    (direction: SequenceArpeggioDirection) => {
      setEnabledArpeggioDirections((currentDirections) =>
        toggleRequiredSetValue(currentDirections, direction),
      );
    },
    [],
  );

  const toggleChordProgressionKey = useCallback(
    (keyId: ChordProgressionKeyId) => {
      setEnabledChordProgressionKeyIds((currentKeyIds) => {
        const nextKeyIds = new Set(currentKeyIds);

        if (nextKeyIds.has(keyId)) {
          nextKeyIds.delete(keyId);
        } else {
          nextKeyIds.add(keyId);
        }

        if (
          nextKeyIds.size === 0 ||
          !hasCompatibleProgressionSelection(
            nextKeyIds,
            enabledChordProgressionTemplateIds,
          )
        ) {
          return currentKeyIds;
        }

        return nextKeyIds;
      });
    },
    [enabledChordProgressionTemplateIds],
  );

  const toggleChordProgressionTemplate = useCallback(
    (templateId: ChordProgressionTemplateId) => {
      setEnabledChordProgressionTemplateIds((currentTemplateIds) => {
        const nextTemplateIds = new Set(currentTemplateIds);

        if (nextTemplateIds.has(templateId)) {
          nextTemplateIds.delete(templateId);
        } else {
          nextTemplateIds.add(templateId);
        }

        if (
          nextTemplateIds.size === 0 ||
          !hasCompatibleProgressionSelection(
            enabledChordProgressionKeyIds,
            nextTemplateIds,
          )
        ) {
          return currentTemplateIds;
        }

        return nextTemplateIds;
      });
    },
    [enabledChordProgressionKeyIds],
  );

  return {
    enabledArpeggios,
    enabledArpeggioDirections,
    enabledChordProgressionKeyIds,
    enabledChordProgressionTemplateIds,
    enabledDirections,
    enabledIntervals,
    enabledNoteCategories,
    enabledScaleDirections,
    enabledScales,
    exerciseType,
    mode,
    setExerciseType,
    setMode,
    setShowTargetName,
    showTargetName,
    toggleArpeggio,
    toggleArpeggioDirection,
    toggleChordProgressionKey,
    toggleChordProgressionTemplate,
    toggleDirection,
    toggleInterval,
    toggleNoteCategory,
    toggleScale,
    toggleScaleDirection,
  };
}
