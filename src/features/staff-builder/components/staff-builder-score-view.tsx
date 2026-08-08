import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { renderStaffBuilderMeasure, type StaffBuilderMeasureRenderResult } from "../notation/render-staff-builder-measure";
import { projectStaffBuilderMeasure, projectStaffBuilderPendingPreview } from "../notation/staff-builder-notation";
import type { StaffBuilderPendingCapture } from "../staff-builder-capture";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { stepDurationToTicks, type StaffBuilderStepDuration } from "../staff-builder-time";
import type { StaffBuilderIssue } from "../staff-builder-validation";

type CursorGeometry = Readonly<{ x: number; y: number; width: number; height: number }>;

const EMPTY_PENDING_PREVIEW: StaffBuilderPendingCapture = { treble: [], bass: [] };

export function StaffBuilderScoreView({ score, measureIndex, cursor, pendingPreview, selectedEventId, issue, onRender }: Readonly<{
  score: StaffBuilderScoreV1;
  measureIndex: number;
  cursor?: Readonly<{ offsetTicks: number; stepDuration: StaffBuilderStepDuration }>;
  pendingPreview?: StaffBuilderPendingCapture;
  selectedEventId?: string;
  issue?: StaffBuilderIssue | null;
  onRender?: (result: StaffBuilderMeasureRenderResult) => void;
}>) {
  const notationRef = useRef<HTMLDivElement>(null);
  const [cursorGeometry, setCursorGeometry] = useState<CursorGeometry | null>(null);
  const [selectionGeometry, setSelectionGeometry] = useState<CursorGeometry | null>(null);
  const [issueGeometry, setIssueGeometry] = useState<CursorGeometry | null>(null);
  const projection = projectStaffBuilderMeasure(score, measureIndex);
  const cursorOffsetTicks = cursor?.offsetTicks;
  const cursorStepDuration = cursor?.stepDuration;
  const pendingTreble = pendingPreview?.treble ?? EMPTY_PENDING_PREVIEW.treble;
  const pendingBass = pendingPreview?.bass ?? EMPTY_PENDING_PREVIEW.bass;
  const preview = useMemo(
    () => projectStaffBuilderPendingPreview(score, measureIndex, cursorOffsetTicks ?? 0, { treble: pendingTreble, bass: pendingBass }, cursorStepDuration ?? "quarter"),
    [cursorOffsetTicks, cursorStepDuration, measureIndex, pendingBass, pendingTreble, score],
  );
  const previewEventIds = preview.previewEventIds;
  const previewLayoutDurationTicksByEventId = preview.layoutDurationTicksByEventId;

  useLayoutEffect(() => {
    if (!notationRef.current) return;
    const result = renderStaffBuilderMeasure(notationRef.current, preview.renderScore, measureIndex, {
      excludedEventIds: previewEventIds,
      layoutDurationTicksByEventId: previewLayoutDurationTicksByEventId,
    });
    if (cursorOffsetTicks !== undefined && cursorStepDuration !== undefined) {
      const start = result.anchors.positions.get(cursorOffsetTicks);
      const endTick = Math.min(projection.capacityTicks, cursorOffsetTicks + stepDurationToTicks(cursorStepDuration));
      const covered = [...result.anchors.positions.values()].filter(({ tick }) => tick >= cursorOffsetTicks && tick < endTick);
      const right = covered.reduce((maximum, anchor) => Math.max(maximum, anchor.x + anchor.width), start ? start.x + start.width : 0);
      setCursorGeometry(start ? { x: start.x, y: start.y, width: Math.max(start.width, right - start.x), height: start.height } : null);
    } else {
      setCursorGeometry(null);
    }
    const selectedAnchor = selectedEventId ? result.anchors.events.get(selectedEventId) : undefined;
    setSelectionGeometry(selectedAnchor ? { x: selectedAnchor.x - 5, y: selectedAnchor.y - 5, width: selectedAnchor.width + 10, height: selectedAnchor.height + 10 } : null);
    const issueEvent = issue?.target.eventId ? result.anchors.events.get(issue.target.eventId) : undefined;
    const positions = [...result.anchors.positions.values()].sort((a, b) => a.tick - b.tick);
    const issuePosition = issue?.target.positionTicks === undefined ? undefined : result.anchors.positions.get(issue.target.positionTicks) ?? positions.at(-1);
    if (issueEvent) setIssueGeometry({ x: issueEvent.x - 8, y: issueEvent.y - 8, width: issueEvent.width + 16, height: issueEvent.height + 16 });
    else if (issuePosition) {
      const end = issue?.target.endTicks === undefined ? issuePosition.x + issuePosition.width : positions.filter(({ tick }) => tick < (issue.target.endTicks ?? 0)).reduce((right, anchor) => Math.max(right, anchor.x + anchor.width), issuePosition.x + issuePosition.width);
      setIssueGeometry({ x: issuePosition.x, y: issuePosition.y, width: Math.max(issuePosition.width, end - issuePosition.x), height: issuePosition.height });
    } else setIssueGeometry(null);
    onRender?.(result);
  }, [cursorOffsetTicks, cursorStepDuration, issue, measureIndex, onRender, preview.renderScore, previewEventIds, previewLayoutDurationTicksByEventId, projection.capacityTicks, selectedEventId]);

  return (
    <section aria-labelledby="staff-builder-score-view-title" className="staff-builder-score-view">
      <div className="staff-builder-measure-navigation">
        <h3 className="font-semibold" id="staff-builder-score-view-title">Measure {projection.measureNumber} of {score.measures.length}</h3>
      </div>
      <div className="staff-builder-notation-scroll">
        <div className="staff-builder-notation-canvas">
          <div ref={notationRef} />
          {cursorGeometry && <div aria-hidden="true" className="staff-builder-capture-cursor" data-testid="staff-builder-capture-cursor" style={{ left: cursorGeometry.x, top: cursorGeometry.y, width: cursorGeometry.width, height: cursorGeometry.height }} />}
          {selectionGeometry && <div aria-hidden="true" className="staff-builder-selection-outline" data-testid="staff-builder-selection-outline" style={{ left: selectionGeometry.x, top: selectionGeometry.y, width: selectionGeometry.width, height: selectionGeometry.height }} />}
          {issueGeometry && <div aria-hidden="true" className="staff-builder-issue-outline" data-testid="staff-builder-issue-outline" style={{ left: issueGeometry.x, top: issueGeometry.y, width: issueGeometry.width, height: issueGeometry.height }}><span>!</span></div>}
          {(projection.boundaryTies ?? []).some(({ direction }) => direction === "incoming") && <div aria-hidden="true" className="staff-builder-boundary-tie staff-builder-boundary-tie-incoming">Tie in</div>}
          {(projection.boundaryTies ?? []).some(({ direction }) => direction === "outgoing") && <div aria-hidden="true" className="staff-builder-boundary-tie staff-builder-boundary-tie-outgoing">Tie out</div>}
        </div>
      </div>
      <div className="staff-builder-measure-summary">
        <p><strong>Measure {projection.measureNumber}.</strong> Effective key: {projection.keySignatureName}. Effective time signature: {projection.timeSignature}.</p>
        <p><strong>Treble:</strong> {projection.summary.treble}</p>
        <p><strong>Bass:</strong> {projection.summary.bass}</p>
        {pendingPreview && <><p>{preview.summary.treble}</p><p>{preview.summary.bass}</p></>}
        {(projection.boundaryTies ?? []).map((tie) => <p key={tie.tieId}>{tie.description} Tie {tie.tieId}, {tie.direction}, event {tie.eventId}.</p>)}
        {(projection.invalidEventIds ?? []).length > 0 && <p><strong>Invalid timing:</strong> {projection.invalidEventIds.length} event(s) begin outside this measure and are indicated at the boundary.</p>}
      </div>
    </section>
  );
}
