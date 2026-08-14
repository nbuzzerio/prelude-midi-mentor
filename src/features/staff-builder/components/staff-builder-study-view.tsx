import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StaffBuilderScore } from "../staff-builder-types";
import { getStaffBuilderAnnotationLayer, STAFF_BUILDER_ANNOTATION_LAYERS, type StaffBuilderAnnotationLayer } from "../staff-builder-annotation-layers";
import { STAFF_BUILDER_ANNOTATION_LAYER_LABELS } from "../staff-builder-annotation-presentation";
import { getStaffBuilderStudyAnnotationMarkerKey, projectStaffBuilderStudyAnnotations } from "../staff-builder-study-annotations";
import type { StaffBuilderSystemRenderResult } from "../notation/render-staff-builder-system";
import { layoutStaffBuilderScoreSystems } from "../notation/staff-builder-system-layout";
import { getStaffBuilderStudyLayoutConstraints } from "../staff-builder-study-layout";
import { StaffBuilderMultiSystemScore } from "./staff-builder-multi-system-score";
import { StaffBuilderStudyAnnotations } from "./staff-builder-study-annotations";

export type StaffBuilderStudyViewProps = Readonly<{
  score: StaffBuilderScore;
  visibleAnnotationLayers: ReadonlySet<StaffBuilderAnnotationLayer>;
  onLayerVisibilityChange: (layer: StaffBuilderAnnotationLayer, visible: boolean) => void;
  onShowAllAnnotationLayers: () => void;
  onHideAllAnnotationLayers: () => void;
  onExit: () => void;
}>;

export function StaffBuilderStudyView({ score, visibleAnnotationLayers, onLayerVisibilityChange, onShowAllAnnotationLayers, onHideAllAnnotationLayers, onExit }: StaffBuilderStudyViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [renderGeometry, setRenderGeometry] = useState<Readonly<{ layout: ReturnType<typeof layoutStaffBuilderScoreSystems>; results: readonly StaffBuilderSystemRenderResult[] }> | null>(null);
  const [selectedAnnotationKey, setSelectedAnnotationKey] = useState<string | null>(null);

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
  const receiveRenderResults = useCallback((results: readonly StaffBuilderSystemRenderResult[]) => {
    if (layout) setRenderGeometry({ layout, results });
  }, [layout]);
  const annotations = useMemo(() => layout ? projectStaffBuilderStudyAnnotations(score, layout, renderGeometry?.layout === layout ? renderGeometry.results : [], visibleAnnotationLayers) : { records: [], markers: [] }, [layout, renderGeometry, score, visibleAnnotationLayers]);
  const visibleSelectedAnnotationKey = selectedAnnotationKey && annotations.markers.some(({ key }) => key === selectedAnnotationKey) ? selectedAnnotationKey : null;
  const selectedAnnotation = selectedAnnotationKey
    ? annotations.records.find(({ annotation }) => getStaffBuilderStudyAnnotationMarkerKey(annotation) === selectedAnnotationKey)?.annotation
    : undefined;

  return <section aria-labelledby="staff-builder-study-view-title" className="staff-builder-study-view">
    <header className="staff-builder-study-view-header">
      <div className="staff-builder-study-view-title-row"><h1 id="staff-builder-study-view-title">{score.title}</h1><button className="staff-builder-secondary-button" onClick={onExit} ref={exitRef} type="button">Exit Study View</button></div>
      <div aria-label="Study View annotation layers" className="staff-builder-study-view-layer-controls">{STAFF_BUILDER_ANNOTATION_LAYERS.map((layer) => <label key={layer}><input checked={visibleAnnotationLayers.has(layer)} onChange={(event) => { if (!event.target.checked && selectedAnnotation && getStaffBuilderAnnotationLayer(selectedAnnotation) === layer) setSelectedAnnotationKey(null); onLayerVisibilityChange(layer, event.target.checked); }} type="checkbox" />{STAFF_BUILDER_ANNOTATION_LAYER_LABELS[layer]}</label>)}<button className="staff-builder-secondary-button" onClick={onShowAllAnnotationLayers} type="button">Show All</button><button className="staff-builder-secondary-button" onClick={() => { setSelectedAnnotationKey(null); onHideAllAnnotationLayers(); }} type="button">Hide All</button></div>
    </header>
    <div aria-label={`${score.title} Study View score, scroll to explore`} className="staff-builder-study-view-viewport" ref={viewportRef} tabIndex={0}>
      <div className="staff-builder-study-view-transform">
        <div className="staff-builder-study-view-document">
          {layout && <><StaffBuilderMultiSystemScore layout={layout} onRenderResultsChange={receiveRenderResults} score={score} /><StaffBuilderStudyAnnotations onSelect={setSelectedAnnotationKey} presentation="markers" projection={annotations} selectedKey={visibleSelectedAnnotationKey} /></>}
        </div>
      </div>
    </div>
    <StaffBuilderStudyAnnotations onSelect={setSelectedAnnotationKey} presentation="list" projection={annotations} selectedKey={visibleSelectedAnnotationKey} />
  </section>;
}
