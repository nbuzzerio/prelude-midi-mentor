import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StaffBuilderEventHighlight } from "@/features/staff-builder/components/staff-builder-score-view";
import type { ContinuousPassage } from "./continuous-types";
import { ContinuousScore } from "./continuous-score";
import { continuousReadingEnvelope, continuousReadingSlots, CONTINUOUS_READING_SCALE } from "./continuous-reading";

const EMPTY: readonly StaffBuilderEventHighlight[] = [];

export function ContinuousReadingView({ passage, measureIndex, offsetTicks, highlights = EMPTY, review = false }: Readonly<{
  passage: ContinuousPassage; measureIndex: number; offsetTicks?: number;
  highlights?: readonly StaffBuilderEventHighlight[]; review?: boolean;
}>) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1100);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => { if (element.clientWidth > 0) setWidth(element.clientWidth); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const envelope = useMemo(() => continuousReadingEnvelope(passage.score, passage.start, passage.end), [passage]);
  const columns = !review && width >= 900 ? 2 : 1;
  const slotWidth = (width - (columns - 1) * 12) / columns;
  const reading = useMemo(() => ({ ...envelope, width: Math.max(280, (slotWidth - 2) / CONTINUOUS_READING_SCALE) }), [envelope, slotWidth]);
  return <div ref={container} className="continuous-reading" data-columns={columns} aria-label="Current and upcoming grand staff">
    {continuousReadingSlots(passage.start, passage.end, measureIndex, review).map(({ measureIndex: index, slot, prepared }) =>
      <div key={index} className={`continuous-reading-slot${prepared ? " continuous-reading-prepared" : ""}`}
        style={{ gridColumn: columns === 2 && !review ? slot + 1 : 1, gridRow: columns === 2 || review ? 1 : slot + 1, width: prepared ? slotWidth : undefined }}
        aria-hidden={prepared || undefined} inert={prepared || undefined}
        data-continuous-active-measure={index === measureIndex ? index + 1 : undefined}
        data-continuous-next-measure={index === measureIndex + 1 ? index + 1 : undefined}>
        <h2 className="font-bold">{review ? "Review" : index === measureIndex ? "Active" : "Next"} · measure {index + 1}</h2>
        <ContinuousScore score={passage.score} measureIndex={index} offsetTicks={index === measureIndex ? offsetTicks : undefined}
          highlights={index === measureIndex ? highlights : EMPTY} reading={reading} prepared={prepared} />
      </div>)}
  </div>;
}
