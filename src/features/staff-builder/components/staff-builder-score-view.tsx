import { useLayoutEffect, useRef, useState } from "react";
import { renderStaffBuilderMeasure, type StaffBuilderMeasureRenderResult } from "../notation/render-staff-builder-measure";
import { projectStaffBuilderMeasure } from "../notation/staff-builder-notation";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";

export function StaffBuilderScoreView({ score, onRender }: Readonly<{
  score: StaffBuilderScoreV1;
  onRender?: (result: StaffBuilderMeasureRenderResult) => void;
}>) {
  const [measureIndex, setMeasureIndex] = useState(0);
  const notationRef = useRef<HTMLDivElement>(null);
  const projection = projectStaffBuilderMeasure(score, measureIndex);

  useLayoutEffect(() => {
    if (!notationRef.current) return;
    const result = renderStaffBuilderMeasure(notationRef.current, score, measureIndex);
    onRender?.(result);
  }, [measureIndex, onRender, score]);

  return (
    <section aria-labelledby="staff-builder-score-view-title" className="staff-builder-score-view">
      <div className="staff-builder-measure-navigation">
        <button className="staff-builder-secondary-button" disabled={measureIndex === 0} onClick={() => setMeasureIndex((current) => current - 1)} type="button">Previous Measure</button>
        <h3 className="font-semibold" id="staff-builder-score-view-title">Measure {projection.measureNumber} of {score.measures.length}</h3>
        <button className="staff-builder-secondary-button" disabled={measureIndex >= score.measures.length - 1} onClick={() => setMeasureIndex((current) => current + 1)} type="button">Next Measure</button>
      </div>
      <div className="staff-builder-notation-scroll">
        <div className="staff-builder-notation-canvas" ref={notationRef} />
      </div>
      <div className="staff-builder-measure-summary">
        <p><strong>Measure {projection.measureNumber}.</strong> Effective key: {projection.keySignatureName}. Effective time signature: {projection.timeSignature}.</p>
        <p><strong>Treble:</strong> {projection.summary.treble}</p>
        <p><strong>Bass:</strong> {projection.summary.bass}</p>
      </div>
    </section>
  );
}
