import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { renderStaffBuilderMeasure, type StaffBuilderMeasureRenderResult } from "../notation/render-staff-builder-measure";
import { projectStaffBuilderMeasure, projectStaffBuilderPendingPreview } from "../notation/staff-builder-notation";
import type { StaffBuilderCaptureInputMode, StaffBuilderPendingCapture } from "../staff-builder-capture";
import type { StaffBuilderEventSelection } from "../staff-builder-rhythm";
import type { StaffBuilderEvent, StaffBuilderScoreV1 } from "../staff-builder-types";
import { stepDurationToTicks, type StaffBuilderDuration, type StaffBuilderStepDuration } from "../staff-builder-time";
import type { StaffBuilderIssue } from "../staff-builder-validation";
import { StaffBuilderDurationWheel } from "./staff-builder-duration-wheel";
import { StaffBuilderStaffModeSelector } from "./staff-builder-staff-mode-selector";

type CursorGeometry = Readonly<{ x: number; y: number; width: number; height: number }>;
type PointerGesture = Readonly<{ pointerId: number; startX: number; startY: number; eventId: string }>;

const EMPTY_PENDING_PREVIEW: StaffBuilderPendingCapture = { treble: [], bass: [] };
const TAP_MOVEMENT_THRESHOLD_PX = 8;

function durationName(event: StaffBuilderEvent): string {
  return event.rhythm.status === "final" ? event.rhythm.duration.replace("-", " ") : "Unresolved-duration";
}

function eventAccessibleName(event: StaffBuilderEvent, measureIndex: number): string {
  const location = `${event.staff} staff, measure ${measureIndex + 1}`;
  if (event.kind === "rest") return `${durationName(event)} rest, ${location}`;
  const pitches = event.pitches.map(({ letter, accidental, octave }) => `${letter}${accidental === "sharp" ? "♯" : accidental === "flat" ? "♭" : ""}${octave}`);
  return pitches.length > 1
    ? `${durationName(event)}-note chord ${pitches.slice(0, -1).join(", ")} and ${pitches.at(-1)}, ${location}`
    : `${durationName(event)} note ${pitches[0] ?? "without pitch"}, ${location}`;
}

export function StaffBuilderScoreView({ score, measureIndex, cursor, pendingPreview, selectedEventId, issue, inputMode = "grand", staffModeDisabled = true, onInputModeChange, onEventSelect, onAssignDuration, onRender }: Readonly<{
  score: StaffBuilderScoreV1;
  measureIndex: number;
  cursor?: Readonly<{ offsetTicks: number; stepDuration: StaffBuilderStepDuration }>;
  pendingPreview?: StaffBuilderPendingCapture;
  selectedEventId?: string;
  issue?: StaffBuilderIssue | null;
  inputMode?: StaffBuilderCaptureInputMode;
  staffModeDisabled?: boolean;
  onInputModeChange?: (mode: StaffBuilderCaptureInputMode) => void;
  onEventSelect?: (selection: StaffBuilderEventSelection) => boolean;
  onAssignDuration?: (duration: StaffBuilderDuration) => boolean;
  onRender?: (result: StaffBuilderMeasureRenderResult) => void;
}>) {
  const notationRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointerGesture = useRef<PointerGesture | null>(null);
  const ignoredSyntheticClick = useRef<symbol | null>(null);
  const [cursorGeometry, setCursorGeometry] = useState<CursorGeometry | null>(null);
  const [selectionGeometry, setSelectionGeometry] = useState<CursorGeometry | null>(null);
  const [issueGeometry, setIssueGeometry] = useState<CursorGeometry | null>(null);
  const [renderResult, setRenderResult] = useState<StaffBuilderMeasureRenderResult | null>(null);
  const [durationEventId, setDurationEventId] = useState<string | null>(null);
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
    setRenderResult(result);
    if (cursorOffsetTicks !== undefined && cursorStepDuration !== undefined) {
      const start = result.anchors.positions.get(cursorOffsetTicks);
      const endTick = Math.min(projection.capacityTicks, cursorOffsetTicks + stepDurationToTicks(cursorStepDuration));
      const covered = [...result.anchors.positions.values()].filter(({ tick }) => tick >= cursorOffsetTicks && tick < endTick);
      const right = covered.reduce((maximum, anchor) => Math.max(maximum, anchor.x + anchor.width), start ? start.x + start.width : 0);
      setCursorGeometry(start ? { x: start.x, y: start.y, width: Math.max(start.width, right - start.x), height: start.height } : null);
    } else {
      setCursorGeometry(null);
    }
    const selectedAnchor = selectedEventId ? result.anchors.authoritativeEvents.get(selectedEventId) : undefined;
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

  const authoritativeTargets = [...(renderResult?.anchors.authoritativeEvents.values() ?? [])]
    .map((anchor, order) => ({ anchor, order, event: score.measures[measureIndex]?.events.find(({ id }) => id === anchor.eventId) }))
    .filter((target): target is typeof target & { event: StaffBuilderEvent } => target.event !== undefined);
  const selectedEvent = score.measures[measureIndex]?.events.find(({ id }) => id === selectedEventId);
  const durationAnchor = durationEventId && durationEventId === selectedEventId ? renderResult?.anchors.authoritativeEvents.get(durationEventId) : undefined;

  const activateEvent = (eventId: string) => {
    if (!onEventSelect?.({ measureIndex, eventId })) return;
    setDurationEventId(eventId);
  };
  const resolvePointerTarget = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const coordinateSpace = renderResult?.coordinateSpace;
    if (!canvas || !coordinateSpace) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * coordinateSpace.width / Math.max(rect.width, 1);
    const y = (clientY - rect.top) * coordinateSpace.height / Math.max(rect.height, 1);
    const candidates = authoritativeTargets.map((target) => {
      const { anchor } = target;
      const width = Math.max(44, anchor.width);
      const height = Math.max(44, anchor.height);
      const left = anchor.x + anchor.width / 2 - width / 2;
      const top = anchor.y + anchor.height / 2 - height / 2;
      return { ...target, actual: x >= anchor.x && x <= anchor.x + anchor.width && y >= anchor.y && y <= anchor.y + anchor.height, distance: Math.abs(x - anchor.onsetX), area: anchor.width * anchor.height, contains: x >= left && x <= left + width && y >= top && y <= top + height };
    }).filter(({ contains }) => contains).sort((left, right) => Number(right.actual) - Number(left.actual) || left.distance - right.distance || left.area - right.area || left.order - right.order);
    return candidates[0]?.event.id ?? null;
  };
  const handlePointerUp = (pointerId: number, clientX: number, clientY: number) => {
    const gesture = pointerGesture.current;
    if (!gesture || gesture.pointerId !== pointerId) return;
    pointerGesture.current = null;
    const token = Symbol("pointer-click");
    ignoredSyntheticClick.current = token;
    window.setTimeout(() => { if (ignoredSyntheticClick.current === token) ignoredSyntheticClick.current = null; }, 0);
    if (Math.hypot(clientX - gesture.startX, clientY - gesture.startY) > TAP_MOVEMENT_THRESHOLD_PX) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    [...canvas.querySelectorAll<HTMLButtonElement>(".staff-builder-event-target")].find(({ dataset }) => dataset.eventId === gesture.eventId)?.focus({ preventScroll: true });
    activateEvent(gesture.eventId);
  };
  const handlePointerDown = (pointerEvent: ReactPointerEvent<HTMLDivElement>) => {
    if (!(pointerEvent.target as Element).closest(".staff-builder-event-target")) { pointerGesture.current = null; return; }
    const eventId = resolvePointerTarget(pointerEvent.clientX, pointerEvent.clientY);
    pointerGesture.current = eventId ? { pointerId: pointerEvent.pointerId, startX: pointerEvent.clientX, startY: pointerEvent.clientY, eventId } : null;
  };
  const closeDuration = () => {
    const returnTo = durationEventId;
    setDurationEventId(null);
    if (returnTo) requestAnimationFrame(() => [...(canvasRef.current?.querySelectorAll<HTMLButtonElement>(".staff-builder-event-target") ?? [])].find(({ dataset }) => dataset.eventId === returnTo)?.focus({ preventScroll: true }));
  };

  return (
    <section aria-labelledby="staff-builder-score-view-title" className="staff-builder-score-view">
      <div className="staff-builder-measure-navigation">
        <h3 className="sr-only" id="staff-builder-score-view-title">Measure {projection.measureNumber} of {score.measures.length}</h3>
      </div>
      <div className="staff-builder-score-interaction-plane">
        {onInputModeChange && <StaffBuilderStaffModeSelector disabled={staffModeDisabled} inputMode={inputMode} onChange={onInputModeChange} />}
        <div className="staff-builder-notation-scroll">
        <div className="staff-builder-notation-canvas" onPointerCancel={() => { pointerGesture.current = null; }} onPointerDown={handlePointerDown} onPointerUp={(pointerEvent) => handlePointerUp(pointerEvent.pointerId, pointerEvent.clientX, pointerEvent.clientY)} ref={canvasRef}>
          <div ref={notationRef} />
          {onEventSelect && authoritativeTargets.map(({ anchor, event }) => {
            const width = Math.max(44, anchor.width);
            const height = Math.max(44, anchor.height);
            return <button aria-label={eventAccessibleName(event, measureIndex)} className="staff-builder-event-target" data-event-id={event.id} key={event.id} onClick={(clickEvent) => {
              if (clickEvent.detail !== 0 && ignoredSyntheticClick.current !== null) { ignoredSyntheticClick.current = null; return; }
              activateEvent(event.id);
            }} style={{ left: anchor.x + anchor.width / 2 - width / 2, top: anchor.y + anchor.height / 2 - height / 2, width, height }} type="button" />;
          })}
          {cursorGeometry && <div aria-hidden="true" className="staff-builder-capture-cursor" data-testid="staff-builder-capture-cursor" style={{ left: cursorGeometry.x, top: cursorGeometry.y, width: cursorGeometry.width, height: cursorGeometry.height }} />}
          {selectionGeometry && <div aria-hidden="true" className="staff-builder-selection-outline" data-testid="staff-builder-selection-outline" style={{ left: selectionGeometry.x, top: selectionGeometry.y, width: selectionGeometry.width, height: selectionGeometry.height }} />}
          {issueGeometry && <div aria-hidden="true" className="staff-builder-issue-outline" data-testid="staff-builder-issue-outline" style={{ left: issueGeometry.x, top: issueGeometry.y, width: issueGeometry.width, height: issueGeometry.height }}><span>!</span></div>}
          {(projection.boundaryTies ?? []).some(({ direction }) => direction === "incoming") && <div aria-hidden="true" className="staff-builder-boundary-tie staff-builder-boundary-tie-incoming">Tie in</div>}
          {(projection.boundaryTies ?? []).some(({ direction }) => direction === "outgoing") && <div aria-hidden="true" className="staff-builder-boundary-tie staff-builder-boundary-tie-outgoing">Tie out</div>}
          {durationAnchor && selectedEvent && renderResult && onAssignDuration && <StaffBuilderDurationWheel anchor={durationAnchor} coordinateSpace={renderResult.coordinateSpace} currentDuration={selectedEvent.rhythm.status === "final" ? selectedEvent.rhythm.duration : undefined} eventKind={selectedEvent.kind} key={durationEventId} onChoose={(duration) => {
            if (selectedEvent.rhythm.status === "final" && selectedEvent.rhythm.duration === duration) { closeDuration(); return; }
            if (onAssignDuration(duration)) closeDuration();
          }} onClose={closeDuration} />}
        </div>
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
