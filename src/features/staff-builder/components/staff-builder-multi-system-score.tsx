import { useLayoutEffect, useRef } from "react";
import type { StaffBuilderScore } from "../staff-builder-types";
import { renderStaffBuilderSystem } from "../notation/render-staff-builder-system";
import { projectStaffBuilderMeasure } from "../notation/staff-builder-notation";
import type { StaffBuilderScoreDocumentLayout, StaffBuilderSystemLayout } from "../notation/staff-builder-system-layout";

export type StaffBuilderMultiSystemScoreProps = Readonly<{
  score: StaffBuilderScore;
  layout: StaffBuilderScoreDocumentLayout;
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

function StaffBuilderSystemVisual({ score, system }: Readonly<{ score: StaffBuilderScore; system: StaffBuilderSystemLayout }>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    renderStaffBuilderSystem(container, score, system);
    return () => container.replaceChildren();
  }, [score, system]);

  return (
    <div
      aria-hidden="true"
      data-staff-builder-system={system.systemIndex}
      ref={containerRef}
      style={{ position: "absolute", left: system.x, top: system.y, width: system.width, height: system.height }}
    />
  );
}

export function StaffBuilderMultiSystemScore({ score, layout }: StaffBuilderMultiSystemScoreProps) {
  return (
    <div data-staff-builder-score-document style={{ position: "relative", width: layout.width, height: layout.height }}>
      <div aria-hidden="true">
        {layout.systems.map((system) => <StaffBuilderSystemVisual key={system.systemIndex} score={score} system={system} />)}
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
