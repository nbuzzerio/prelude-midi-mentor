import { memo, useId, useLayoutEffect, useRef, useState } from "react";
import { renderStaffBuilderMeasure, type StaffBuilderMeasureRenderResult } from "@/features/staff-builder/notation/render-staff-builder-measure";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { getMelodyReadingLayout, getMelodyReadingScrollLeft } from "../melody-reading-layout";
import { resolveMelodyReadingPosition } from "../melody-reading-position";
import { getMelodyPreparationCue } from "../melody-preparation-cue";

/** A readonly view of an existing authored measure. It owns no input or transport. */
export const MelodyReadingMeasure = memo(function MelodyReadingMeasure({ score, measureIndex, measureCount, staff, role, offsetTicks, preparationTick, expanded }: Readonly<{
  score: StaffBuilderScore;
  /** Index in the practice projection, whose index zero is preparation. */
  measureIndex: number;
  measureCount: 1 | 2;
  staff: "treble" | "bass";
  role: "current" | "upcoming" | "completed";
  offsetTicks?: number;
  preparationTick?: number;
  expanded: boolean;
}>) {
  const id = useId();
  const notation = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(760);
  const [rendered, setRendered] = useState<StaffBuilderMeasureRenderResult | null>(null);
  const layout = getMelodyReadingLayout(availableWidth, measureCount === 2, expanded);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const measure = () => { if (element.clientWidth > 0) setAvailableWidth(element.clientWidth); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // The cursor and current/upcoming role deliberately do not invalidate notation.
  useLayoutEffect(() => {
    if (notation.current) setRendered(renderStaffBuilderMeasure(notation.current, score, measureIndex, {
      visibleStaff: staff, readingFlowWidth: layout.width, readingFlowCompact: true,
    }));
  }, [score, measureIndex, staff, layout.width]);
  const events = score.measures[measureIndex]?.events ?? [];
  const preparation = getMelodyPreparationCue(preparationTick);
  const geometry = rendered ? resolveMelodyReadingPosition({ anchors: rendered.anchors, events, staff, tick: preparation ? 0 : offsetTicks }) : null;
  const opening = rendered ? resolveMelodyReadingPosition({ anchors: rendered.anchors, events, staff, tick: 0 }) : null;
  const cursorX = geometry?.x;
  const openingX = opening?.x ?? 0;
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element || role === "completed") return;
    element.scrollLeft = role !== "current" || cursorX === undefined ? 0 : getMelodyReadingScrollLeft(
      cursorX * layout.scale, openingX * layout.scale, element.clientWidth, (rendered?.width ?? layout.width) * layout.scale,
    );
  }, [cursorX, openingX, role, layout.scale, layout.width, availableWidth, rendered?.width]);
  const width = rendered?.width ?? layout.width;
  const height = rendered?.height ?? 149;
  const cursorTop = geometry ? Math.max(0, Math.min(height, geometry.y)) : 0;
  const cursorHeight = geometry ? Math.max(0, Math.min(height - cursorTop, geometry.height)) : 0;
  return <figure className="melody-reading-measure" data-measure-index={measureIndex} data-measure-role={role} aria-labelledby={`${id}-caption`}>
    <figcaption id={`${id}-caption`} className="melody-reading-caption">
      <span>Measure {measureIndex} of {measureCount}</span>
      <span className="melody-reading-role">{role === "upcoming" ? "Coming next" : role === "completed" ? "Played" : "Current"}</span>
    </figcaption>
    <p className="sr-only" id={`${id}-description`}>{`${staff === "treble" ? "Treble" : "Bass"} clef. ${rendered?.projection.keySignatureName ?? ""}. ${rendered?.projection.timeSignature ?? ""}. ${rendered?.projection.summary[staff] ?? ""}`}</p>
    <div className="melody-reading-scroll" ref={scroll} role="region" tabIndex={0} aria-label={`Measure ${measureIndex} notation`} aria-describedby={`${id}-description`}>
      <div className="melody-reading-presentation" data-reading-scale={layout.scale} style={{ width: width * layout.scale, height: height * layout.scale }}>
        <div className="melody-reading-canvas" style={{ width, height, transform: `scale(${layout.scale})` }}>
          <div ref={notation} aria-hidden="true" />
          {geometry && <div aria-hidden="true" className="melody-reading-cursor" data-preparing={preparation ? "true" : undefined} data-pulsing={preparation?.pulsing ? "true" : undefined} data-cursor-tick={preparation ? 0 : offsetTicks} data-cursor-x={geometry.x} style={{ left: geometry.x, top: cursorTop, height: cursorHeight }} />}
          {geometry && preparation && <span className="melody-preparation-number" role="status" aria-live="polite" aria-atomic="true" aria-label={`Count in: ${preparation.remaining}`} style={{ left: geometry.x }}>{preparation.remaining}</span>}
        </div>
      </div>
    </div>
  </figure>;
});
