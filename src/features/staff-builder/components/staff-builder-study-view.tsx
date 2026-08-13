import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StaffBuilderScore } from "../staff-builder-types";
import { layoutStaffBuilderScoreSystems } from "../notation/staff-builder-system-layout";
import { getStaffBuilderStudyLayoutConstraints } from "../staff-builder-study-layout";
import { StaffBuilderMultiSystemScore } from "./staff-builder-multi-system-score";

export type StaffBuilderStudyViewProps = Readonly<{
  score: StaffBuilderScore;
  onExit: () => void;
}>;

export function StaffBuilderStudyView({ score, onExit }: StaffBuilderStudyViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => { exitRef.current?.focus(); }, []);
  useEffect(() => {
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onExit();
    };
    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [onExit]);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = (width: number) => {
      const normalized = Math.floor(width);
      if (normalized > 0) setContentWidth((current) => current === normalized ? current : normalized);
    };
    update(viewport.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries.find(({ target }) => target === viewport);
      update(entry?.contentRect.width ?? viewport.clientWidth);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => contentWidth > 0
    ? layoutStaffBuilderScoreSystems(score, getStaffBuilderStudyLayoutConstraints(contentWidth))
    : null, [contentWidth, score]);

  return <section aria-labelledby="staff-builder-study-view-title" className="staff-builder-study-view">
    <header className="staff-builder-study-view-header">
      <h1 id="staff-builder-study-view-title">{score.title}</h1>
      <button className="staff-builder-secondary-button" onClick={onExit} ref={exitRef} type="button">Exit Study View</button>
    </header>
    <div aria-label={`${score.title} Study View score, scroll to explore`} className="staff-builder-study-view-viewport" ref={viewportRef} tabIndex={0}>
      <div className="staff-builder-study-view-transform">
        <div className="staff-builder-study-view-document">
          {layout && <StaffBuilderMultiSystemScore layout={layout} score={score} />}
        </div>
      </div>
    </div>
  </section>;
}
