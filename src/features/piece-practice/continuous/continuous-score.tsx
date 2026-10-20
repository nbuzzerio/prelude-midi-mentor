import { memo, useId, useLayoutEffect, useRef, useState } from "react";
import { renderStaffBuilderMeasure, type StaffBuilderMeasureRenderResult } from "@/features/staff-builder/notation/render-staff-builder-measure";
import { resolveStaffBuilderPlaybackGeometry } from "@/features/staff-builder/components/staff-builder-playback-geometry";
import { getStaffBuilderReadingScrollLeft } from "@/features/staff-builder/notation/staff-builder-reading-layout";
import type { StaffBuilderEventHighlight } from "@/features/staff-builder/components/staff-builder-score-view";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";

const SCALE = 1.6;
const EMPTY_HIGHLIGHTS: readonly StaffBuilderEventHighlight[] = [];

/** Feature-local music-stand wrapper; all notation, spelling, ties and spacing use the canonical renderer. */
export const ContinuousScore = memo(function ContinuousScore({ score, measureIndex, offsetTicks, highlights = EMPTY_HIGHLIGHTS }: Readonly<{
  score: StaffBuilderScore; measureIndex: number; offsetTicks?: number; highlights?: readonly StaffBuilderEventHighlight[];
}>) {
  const id = useId();
  const notation = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState<StaffBuilderMeasureRenderResult | null>(null);
  useLayoutEffect(() => {
    if (notation.current) setRendered(renderStaffBuilderMeasure(notation.current, score, measureIndex));
  }, [score, measureIndex]);
  const geometry = rendered && offsetTicks !== undefined ? resolveStaffBuilderPlaybackGeometry(rendered.anchors.timeline, offsetTicks) : null;
  const center = geometry ? (geometry.x + geometry.width / 2) * SCALE : 0;
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const follow = () => { element.scrollLeft = getStaffBuilderReadingScrollLeft(center, element.clientWidth, (rendered?.width ?? 760) * SCALE); };
    follow();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(follow); observer.observe(element);
    return () => observer.disconnect();
  }, [center, measureIndex, rendered?.width]);
  return <figure className="m-0 min-w-0 rounded-lg border border-zinc-500 bg-white text-zinc-950" aria-labelledby={`${id}-caption`}>
    <figcaption className="sr-only" id={`${id}-caption`}>Measure {measureIndex + 1}. {rendered?.projection.keySignatureName}; {rendered?.projection.timeSignature}. Upper staff: {rendered?.projection.summary.treble}. Lower staff: {rendered?.projection.summary.bass}.</figcaption>
    <div className="staff-builder-notation-scroll" ref={scroll} tabIndex={0} role="region" aria-label={`Measure ${measureIndex + 1} score; automatically follows the musical clock`}>
      <div style={{ width: (rendered?.width ?? 760) * SCALE, height: (rendered?.height ?? 300) * SCALE }}>
        <div className="relative origin-top-left" style={{ width: rendered?.width ?? 760, height: rendered?.height ?? 300, transform: `scale(${SCALE})` }}>
          <div ref={notation} aria-hidden="true" />
          {geometry && <div aria-hidden="true" className="staff-builder-playback-highlight" data-testid="continuous-playhead" style={{ left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height }} />}
          {highlights.map((h) => {
            const anchor = rendered?.anchors.authoritativeEvents.get(h.eventId);
            const bounds = anchor?.highlightBounds ?? anchor;
            return bounds ? <div key={h.eventId} aria-hidden="true" className="pointer-events-none absolute rounded border-2" style={{ left: bounds.x - 5, top: bounds.y - 5, width: bounds.width + 10, height: bounds.height + 10,
              borderColor: h.status === "correct" ? "#047857" : h.status === "complete" ? "#71717a" : "#b45309", background: h.status === "correct" ? "#10b98122" : "#f59e0b22" }} /> : null;
          })}
        </div>
      </div>
    </div>
  </figure>;
});
