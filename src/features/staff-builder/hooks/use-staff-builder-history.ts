import { useCallback, useState } from "react";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";

export function useStaffBuilderHistory(limit = 50, resetKey: unknown = null) {
  const [past, setPast] = useState<readonly StaffBuilderScoreV1[]>([]);
  const [future, setFuture] = useState<readonly StaffBuilderScoreV1[]>([]);
  const [activeResetKey, setActiveResetKey] = useState(resetKey);

  if (!Object.is(activeResetKey, resetKey)) {
    setActiveResetKey(resetKey);
    setPast([]);
    setFuture([]);
  }

  const record = useCallback((previous: StaffBuilderScoreV1) => {
    setPast((current) => [...current, previous].slice(-limit));
    setFuture([]);
  }, [limit]);

  const undo = useCallback((current: StaffBuilderScoreV1): StaffBuilderScoreV1 | null => {
    const target = past.at(-1);
    if (!target) return null;
    setPast((values) => values.slice(0, -1));
    setFuture((values) => [current, ...values].slice(0, limit));
    return target;
  }, [limit, past]);

  const redo = useCallback((current: StaffBuilderScoreV1): StaffBuilderScoreV1 | null => {
    const target = future[0];
    if (!target) return null;
    setFuture((values) => values.slice(1));
    setPast((values) => [...values, current].slice(-limit));
    return target;
  }, [future, limit]);

  const clear = useCallback(() => { setPast([]); setFuture([]); }, []);
  return { canUndo: past.length > 0, canRedo: future.length > 0, record, undo, redo, clear };
}
