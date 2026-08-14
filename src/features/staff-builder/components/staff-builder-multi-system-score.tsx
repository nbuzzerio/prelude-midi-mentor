import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { StaffBuilderScore } from "../staff-builder-types";
import { renderStaffBuilderSystem, type StaffBuilderSystemRenderResult } from "../notation/render-staff-builder-system";
import { projectStaffBuilderMeasure } from "../notation/staff-builder-notation";
import type { StaffBuilderScoreDocumentLayout, StaffBuilderSystemLayout } from "../notation/staff-builder-system-layout";

export type StaffBuilderMultiSystemScoreProps = Readonly<{
  score: StaffBuilderScore;
  layout: StaffBuilderScoreDocumentLayout;
  onRenderResultsChange?: (results: readonly StaffBuilderSystemRenderResult[]) => void;
}>;

const SEMANTIC_ONLY_STYLE = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

function StaffBuilderSystemVisual({ generation, onRender, score, system }: Readonly<{ generation: symbol; onRender: (generation: symbol, result: StaffBuilderSystemRenderResult) => void; score: StaffBuilderScore; system: StaffBuilderSystemLayout }>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    onRender(generation, renderStaffBuilderSystem(container, score, system));
    return () => container.replaceChildren();
  }, [generation, onRender, score, system]);

  return (
    <div
      aria-hidden="true"
      data-staff-builder-system={system.systemIndex}
      ref={containerRef}
      style={{ position: "absolute", left: system.x, top: system.y, width: system.width, height: system.height }}
    />
  );
}

function StaffBuilderMultiSystemScoreGeneration({ score, layout, onRenderResultsChange }: StaffBuilderMultiSystemScoreProps) {
  const generation = useMemo(() => Symbol("staff-builder-system-render"), []);
  const aggregationRef = useRef({ results: new Map<number, StaffBuilderSystemRenderResult>(), emitted: false });
  const requiredIndexes = useMemo(() => layout.systems.map(({ systemIndex }) => systemIndex), [layout]);
  const reportRender = useCallback((reportedGeneration: symbol, result: StaffBuilderSystemRenderResult) => {
    if (reportedGeneration !== generation) return;
    const aggregation = aggregationRef.current;
    aggregation.results.set(result.system.systemIndex, result);
    if (aggregation.emitted || requiredIndexes.some((index) => !aggregation.results.has(index))) return;
    aggregation.emitted = true;
    onRenderResultsChange?.(requiredIndexes.map((index) => aggregation.results.get(index)!));
  }, [generation, onRenderResultsChange, requiredIndexes]);
  useLayoutEffect(() => {
    const aggregation = aggregationRef.current;
    if (requiredIndexes.length === 0 && !aggregation.emitted) {
      aggregation.emitted = true;
      onRenderResultsChange?.([]);
    }
  }, [onRenderResultsChange, requiredIndexes.length]);
  return (
    <div data-staff-builder-score-document style={{ position: "relative", width: layout.width, height: layout.height }}>
      <div aria-hidden="true">
        {layout.systems.map((system) => <StaffBuilderSystemVisual generation={generation} key={system.systemIndex} onRender={reportRender} score={score} system={system} />)}
      </div>

      <section aria-label={`${score.title} score`} data-staff-builder-score-semantics style={SEMANTIC_ONLY_STYLE}>
        <h2>{score.title}</h2>
        {layout.systems.map((system) => (
          <section aria-labelledby={`staff-builder-system-${system.systemIndex}`} key={system.systemIndex}>
            <h3 id={`staff-builder-system-${system.systemIndex}`}>System {system.systemIndex + 1}</h3>
            <ol>
              {system.measures.map((placement) => {
                const projection = projectStaffBuilderMeasure(score, placement.measureIndex);
                return (
                  <li key={placement.measureId}>
                    <p>Measure {projection.measureNumber}</p>
                    <p>Treble: {projection.summary.treble}</p>
                    <p>Bass: {projection.summary.bass}</p>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </section>
    </div>
  );
}

export function StaffBuilderMultiSystemScore(props: StaffBuilderMultiSystemScoreProps) {
  const renderGenerationKey = `${props.score.id}:${props.score.updatedAt}:${JSON.stringify(props.layout)}`;
  return <StaffBuilderMultiSystemScoreGeneration key={renderGenerationKey} {...props} />;
}
