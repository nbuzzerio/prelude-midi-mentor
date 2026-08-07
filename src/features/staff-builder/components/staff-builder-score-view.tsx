import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { renderStaffBuilderMeasure, type StaffBuilderMeasureRenderResult } from "../notation/render-staff-builder-measure";
import { projectStaffBuilderMeasure, projectStaffBuilderPendingPreview } from "../notation/staff-builder-notation";
import type { StaffBuilderPendingCapture } from "../staff-builder-capture";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { stepDurationToTicks, type StaffBuilderStepDuration } from "../staff-builder-time";

type CursorGeometry = Readonly<{ x: number; y: number; width: number; height: number }>;

const EMPTY_PENDING_PREVIEW: StaffBuilderPendingCapture = { treble: [], bass: [] };

export function StaffBuilderScoreView({ score, measureIndex, cursor, pendingPreview, onRender }: Readonly<{
  score: StaffBuilderScoreV1;
  measureIndex: number;
  cursor?: Readonly<{ offsetTicks: number; stepDuration: StaffBuilderStepDuration }>;
  pendingPreview?: StaffBuilderPendingCapture;
  onRender?: (result: StaffBuilderMeasureRenderResult) => void;
}>) {
  const notationRef = useRef<HTMLDivElement>(null);
  const [cursorGeometry, setCursorGeometry] = useState<CursorGeometry | null>(null);
  const projection = projectStaffBuilderMeasure(score, measureIndex);
  const cursorOffsetTicks = cursor?.offsetTicks;
  const cursorStepDuration = cursor?.stepDuration;
  const pendingTreble = pendingPreview?.treble ?? EMPTY_PENDING_PREVIEW.treble;
  const pendingBass = pendingPreview?.bass ?? EMPTY_PENDING_PREVIEW.bass;
  const preview = useMemo(
    () => projectStaffBuilderPendingPreview(score, measureIndex, cursorOffsetTicks ?? 0, { treble: pendingTreble, bass: pendingBass }),
    [cursorOffsetTicks, measureIndex, pendingBass, pendingTreble, score],
  );

  useLayoutEffect(() => {
    if (!notationRef.current) return;
    const result = renderStaffBuilderMeasure(notationRef.current, preview.renderScore, measureIndex);
    if (cursorOffsetTicks !== undefined && cursorStepDuration !== undefined) {
      const start = result.anchors.positions.get(cursorOffsetTicks);
      const endTick = Math.min(projection.capacityTicks, cursorOffsetTicks + stepDurationToTicks(cursorStepDuration));
      const covered = [...result.anchors.positions.values()].filter(({ tick }) => tick >= cursorOffsetTicks && tick < endTick);
      const right = covered.reduce((maximum, anchor) => Math.max(maximum, anchor.x + anchor.width), start ? start.x + start.width : 0);
      setCursorGeometry(start ? { x: start.x, y: start.y, width: Math.max(start.width, right - start.x), height: start.height } : null);
    } else {
      setCursorGeometry(null);
    }
    onRender?.(result);
  }, [cursorOffsetTicks, cursorStepDuration, measureIndex, onRender, preview.renderScore, projection.capacityTicks]);

  return (
    <section aria-labelledby="staff-builder-score-view-title" className="staff-builder-score-view">
      <div className="staff-builder-measure-navigation">
        <h3 className="font-semibold" id="staff-builder-score-view-title">Measure {projection.measureNumber} of {score.measures.length}</h3>
      </div>
      <div className="staff-builder-notation-scroll">
        <div className="staff-builder-notation-canvas">
          <div ref={notationRef} />
          {cursorGeometry && <div aria-hidden="true" className="staff-builder-capture-cursor" data-testid="staff-builder-capture-cursor" style={{ left: cursorGeometry.x, top: cursorGeometry.y, width: cursorGeometry.width, height: cursorGeometry.height }} />}
        </div>
      </div>
      <div className="staff-builder-measure-summary">
        <p><strong>Measure {projection.measureNumber}.</strong> Effective key: {projection.keySignatureName}. Effective time signature: {projection.timeSignature}.</p>
        <p><strong>Treble:</strong> {projection.summary.treble}</p>
        <p><strong>Bass:</strong> {projection.summary.bass}</p>
        {pendingPreview && <><p>{preview.summary.treble}</p><p>{preview.summary.bass}</p></>}
      </div>
    </section>
  );
}
