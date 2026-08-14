import type { StaffBuilderStudyAnnotationProjection } from "../staff-builder-study-annotations";
import { getStaffBuilderStudyAnnotationMarkerKey } from "../staff-builder-study-annotations";

export function StaffBuilderStudyAnnotations({ projection, selectedKey, onSelect, presentation = "both" }: Readonly<{ projection: StaffBuilderStudyAnnotationProjection; selectedKey: string | null; onSelect: (key: string) => void; presentation?: "markers" | "list" | "both" }>) {
  return <>
    {presentation !== "list" && <div aria-label="Score annotation markers" className="staff-builder-study-annotation-overlay">
      {projection.markers.map((marker) => <button aria-label={marker.accessibleName} aria-pressed={selectedKey === marker.key} className="staff-builder-study-annotation-marker" data-annotation-kind={marker.kind} key={marker.key} onClick={() => onSelect(marker.key)} style={{ left: marker.bounds.x, top: marker.bounds.y }} type="button">{marker.label}{marker.count > 1 ? marker.count : ""}</button>)}
    </div>}
    {presentation !== "markers" && <section aria-labelledby="staff-builder-study-annotations-title" className="staff-builder-study-annotation-region">
      <h2 id="staff-builder-study-annotations-title">Study annotations</h2>
      {projection.records.length === 0 ? <p>No visible annotations.</p> : <ol>{projection.records.map((record) => {
        const markerKey = getStaffBuilderStudyAnnotationMarkerKey(record.annotation);
        return <li data-selected={selectedKey === markerKey || undefined} key={record.annotation.id}><strong>{record.kindLabel}</strong><span>{record.locationLabel}</span><p>{record.content}</p></li>;
      })}</ol>}
    </section>}
  </>;
}
