import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { renderStaffBuilderMeasure, type StaffBuilderMeasureRenderResult } from "../notation/render-staff-builder-measure";
import { projectStaffBuilderMeasure, projectStaffBuilderPendingPreview } from "../notation/staff-builder-notation";
import type { StaffBuilderCaptureInputMode, StaffBuilderPendingCapture } from "../staff-builder-capture";
import type { StaffBuilderEventSelection } from "../staff-builder-rhythm";
import type { StaffBuilderEvent, StaffBuilderScoreV1 } from "../staff-builder-types";
import { stepDurationToTicks, type StaffBuilderDuration, type StaffBuilderStepDuration, type StaffBuilderTimeSignature } from "../staff-builder-time";
import type { StaffBuilderIssue } from "../staff-builder-validation";
import type { MusicKeyId } from "@/lib/music/keys";
import { StaffBuilderDurationWheel } from "./staff-builder-duration-wheel";
import { STAFF_BUILDER_DURATION_WHEEL_SIZE, type StaffBuilderDisplayedAnchor, type StaffBuilderOverlayBounds } from "./staff-builder-duration-wheel-geometry";
import { getStaffBuilderInternalTouchSize, getStaffBuilderPresentationScale, getStaffBuilderTemporalRegion, resolveStaffBuilderStepPositionTick, staffBuilderClientPointToInternal, type StaffBuilderInternalPoint } from "./staff-builder-interaction-geometry";
import { StaffBuilderKeyWheel } from "./staff-builder-key-wheel";
import { STAFF_BUILDER_KEY_WHEEL_SIZE } from "./staff-builder-key-wheel-options";
import { resolveStaffBuilderExpandedNotationControl, resolveStaffBuilderOriginalNotationControl, type StaffBuilderNotationControlName } from "./staff-builder-notation-control-geometry";
import { resolveStaffBuilderPlaybackGeometry } from "./staff-builder-playback-geometry";
import { StaffBuilderTimeWheel, STAFF_BUILDER_TIME_WHEEL_SIZE } from "./staff-builder-time-wheel";

type CursorGeometry = Readonly<{ x: number; y: number; width: number; height: number }>;
type PointerIntent = Readonly<{ kind: "event"; eventId: string }> | Readonly<{ kind: "position"; offsetTicks: number }> | Readonly<{ kind: "notation"; control: StaffBuilderNotationControlName }>;
type PointerGesture = Readonly<{ pointerId: number; startX: number; startY: number; intent: PointerIntent }>;

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

export function StaffBuilderScoreView({ score, measureIndex, cursor, pendingPreview, playbackPosition, selectedEventId, issue, inputMode = "grand", onInputModeChange, onKeyChange, onTimeChange, onEventSelect, onPositionSelect, onAssignDuration, onDeleteEvent, onConvertToRest, onCaptureRestAsNote, onRender }: Readonly<{
  score: StaffBuilderScoreV1;
  measureIndex: number;
  cursor?: Readonly<{ offsetTicks: number; stepDuration: StaffBuilderStepDuration }>;
  pendingPreview?: StaffBuilderPendingCapture;
  playbackPosition?: Readonly<{ offsetTicks: number }>;
  selectedEventId?: string;
  issue?: StaffBuilderIssue | null;
  inputMode?: StaffBuilderCaptureInputMode;
  onInputModeChange?: (mode: StaffBuilderCaptureInputMode) => void;
  onKeyChange?: (measureIndex: number, key: MusicKeyId) => void;
  onTimeChange?: (measureIndex: number, time: StaffBuilderTimeSignature) => void;
  onEventSelect?: (selection: StaffBuilderEventSelection) => boolean;
  onPositionSelect?: (position: Readonly<{ measureIndex: number; offsetTicks: number }>) => boolean;
  onAssignDuration?: (duration: StaffBuilderDuration) => boolean;
  onDeleteEvent?: () => boolean;
  onConvertToRest?: (duration: StaffBuilderDuration) => boolean;
  onCaptureRestAsNote?: (selection: StaffBuilderEventSelection) => boolean;
  onRender?: (result: StaffBuilderMeasureRenderResult) => void;
}>) {
  const notationRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pointerGesture = useRef<PointerGesture | null>(null);
  const ignoredSyntheticClick = useRef<symbol | null>(null);
  const [cursorGeometry, setCursorGeometry] = useState<CursorGeometry | null>(null);
  const [selectionGeometry, setSelectionGeometry] = useState<CursorGeometry | null>(null);
  const [issueGeometry, setIssueGeometry] = useState<CursorGeometry | null>(null);
  const [renderResult, setRenderResult] = useState<StaffBuilderMeasureRenderResult | null>(null);
  const [durationEventId, setDurationEventId] = useState<string | null>(null);
  const [durationOpenedByPointer, setDurationOpenedByPointer] = useState(false);
  const [settingWheel, setSettingWheel] = useState<Readonly<{ kind: "key" | "time"; openedByPointer: boolean }> | null>(null);
  const [durationOverlay, setDurationOverlay] = useState<Readonly<{ anchor: StaffBuilderDisplayedAnchor; bounds: StaffBuilderOverlayBounds }> | null>(null);
  const [settingOverlay, setSettingOverlay] = useState<Readonly<{ anchor: StaffBuilderDisplayedAnchor; bounds: StaffBuilderOverlayBounds }> | null>(null);
  const [hoveredNotationControl, setHoveredNotationControl] = useState<StaffBuilderNotationControlName | null>(null);
  const [presentationScale, setPresentationScale] = useState(1);
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
  const semanticDescription = [
    `Measure ${projection.measureNumber}. Effective key: ${projection.keySignatureName}. Effective time signature: ${projection.timeSignature}.`,
    `Treble: ${projection.summary.treble}`,
    `Bass: ${projection.summary.bass}`,
    ...(pendingPreview ? [preview.summary.treble, preview.summary.bass] : []),
    ...(projection.boundaryTies ?? []).map((tie) => `${tie.description} Tie ${tie.tieId}, ${tie.direction}, event ${tie.eventId}.`),
    ...((projection.invalidEventIds ?? []).length > 0 ? [`Invalid timing: ${projection.invalidEventIds.length} event(s) begin outside this measure and are indicated at the boundary.`] : []),
  ].join(" ");

  useLayoutEffect(() => {
    if (!notationRef.current) return;
    const result = renderStaffBuilderMeasure(notationRef.current, preview.renderScore, measureIndex, {
      excludedEventIds: previewEventIds,
      layoutDurationTicksByEventId: previewLayoutDurationTicksByEventId,
    });
    setRenderResult(result);
    if (cursorOffsetTicks !== undefined && cursorStepDuration !== undefined) {
      const endTick = Math.min(projection.capacityTicks, cursorOffsetTicks + stepDurationToTicks(cursorStepDuration));
      setCursorGeometry(getStaffBuilderTemporalRegion(result.anchors.timeline, cursorOffsetTicks, endTick - cursorOffsetTicks));
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
  const playbackGeometry = playbackPosition && renderResult ? resolveStaffBuilderPlaybackGeometry(renderResult.anchors.timeline, playbackPosition.offsetTicks) : null;

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || typeof ResizeObserver === "undefined") return;
    const update = () => setPresentationScale(getStaffBuilderPresentationScale(scroll.clientWidth, renderResult?.coordinateSpace.width ?? 760));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroll);
    return () => observer.disconnect();
  }, [renderResult?.coordinateSpace.width]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !durationAnchor) { setDurationOverlay(null); return; }
    const update = () => {
      const canvasRect = canvas.getBoundingClientRect();
      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth = visualViewport?.width ?? window.innerWidth;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const margin = 8;
      setDurationOverlay({
        anchor: {
          x: canvasRect.left + durationAnchor.x * presentationScale,
          y: canvasRect.top + durationAnchor.y * presentationScale,
          width: durationAnchor.width * presentationScale,
          height: durationAnchor.height * presentationScale,
        },
        bounds: {
          left: viewportLeft + margin,
          top: viewportTop + margin,
          width: Math.max(STAFF_BUILDER_DURATION_WHEEL_SIZE, viewportWidth - margin * 2),
          height: Math.max(STAFF_BUILDER_DURATION_WHEEL_SIZE, viewportHeight - margin * 2),
        },
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [durationAnchor, presentationScale]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const anchor = settingWheel ? renderResult?.anchors.notationControls[settingWheel.kind === "key" ? "keySignature" : "timeSignature"] : undefined;
    if (!canvas || !anchor) { setSettingOverlay(null); return; }
    const update = () => {
      const canvasRect = canvas.getBoundingClientRect();
      const visualViewport = window.visualViewport;
      const margin = 8;
      const wheelSize = settingWheel?.kind === "key" ? STAFF_BUILDER_KEY_WHEEL_SIZE : STAFF_BUILDER_TIME_WHEEL_SIZE;
      const viewportWidth = visualViewport?.width ?? window.innerWidth;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      setSettingOverlay({
        anchor: { x: canvasRect.left + anchor.x * presentationScale, y: canvasRect.top + anchor.y * presentationScale, width: anchor.width * presentationScale, height: anchor.height * presentationScale },
        bounds: { left: (visualViewport?.offsetLeft ?? 0) + margin, top: (visualViewport?.offsetTop ?? 0) + margin, width: Math.max(wheelSize, viewportWidth - margin * 2), height: Math.max(wheelSize, viewportHeight - margin * 2) },
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [presentationScale, renderResult, settingWheel]);

  const activateEvent = (eventId: string, openedByPointer = false) => {
    if (!onEventSelect?.({ measureIndex, eventId })) return;
    setSettingWheel(null);
    setDurationOpenedByPointer(openedByPointer);
    setDurationEventId(eventId);
  };
  const activateNotationControl = (control: StaffBuilderNotationControlName, openedByPointer: boolean) => {
    if (control === "trebleClef") onInputModeChange?.("treble");
    else if (control === "grandStaff") onInputModeChange?.("grand");
    else if (control === "bassClef") onInputModeChange?.("bass");
    else {
      setDurationEventId(null);
      setSettingWheel({ kind: control === "keySignature" ? "key" : "time", openedByPointer });
    }
  };
  const applicableNotationControls = () => new Set<StaffBuilderNotationControlName>([
    ...(onInputModeChange ? ["trebleClef", "grandStaff", "bassClef"] as const : []),
    ...(onKeyChange ? ["keySignature"] as const : []),
    ...(onTimeChange ? ["timeSignature"] as const : []),
  ]);
  const pointerToInternal = (clientX: number, clientY: number): StaffBuilderInternalPoint | null => {
    const canvas = canvasRef.current;
    const coordinateSpace = renderResult?.coordinateSpace;
    if (!canvas || !coordinateSpace) return null;
    return staffBuilderClientPointToInternal(canvas.getBoundingClientRect(), coordinateSpace, { x: clientX, y: clientY });
  };
  const resolveEventTarget = (point: StaffBuilderInternalPoint) => {
    const { x, y } = point;
    const candidates = authoritativeTargets.map((target) => {
      const { anchor } = target;
      const width = getStaffBuilderInternalTouchSize(anchor.width, presentationScale);
      const height = getStaffBuilderInternalTouchSize(anchor.height, presentationScale);
      const left = anchor.x + anchor.width / 2 - width / 2;
      const top = anchor.y + anchor.height / 2 - height / 2;
      return { ...target, actual: x >= anchor.x && x <= anchor.x + anchor.width && y >= anchor.y && y <= anchor.y + anchor.height, distance: Math.abs(x - anchor.onsetX), area: anchor.width * anchor.height, contains: x >= left && x <= left + width && y >= top && y <= top + height };
    }).filter(({ contains }) => contains).sort((left, right) => Number(right.actual) - Number(left.actual) || left.distance - right.distance || left.area - right.area || left.order - right.order);
    return candidates[0]?.event.id ?? null;
  };
  const resolveActualEventTarget = (point: StaffBuilderInternalPoint) => authoritativeTargets.map((target) => ({
    ...target,
    area: target.anchor.width * target.anchor.height,
    distance: Math.abs(point.x - target.anchor.onsetX),
  })).filter(({ anchor }) => point.x >= anchor.x && point.x <= anchor.x + anchor.width && point.y >= anchor.y && point.y <= anchor.y + anchor.height)
    .sort((left, right) => left.distance - right.distance || left.area - right.area || left.order - right.order)[0]?.event.id ?? null;
  const resolvePointerIntent = (point: StaffBuilderInternalPoint): PointerIntent | null => {
    const notationAnchors = renderResult?.anchors.notationControls;
    const applicable = applicableNotationControls();
    const originalNotationControl = notationAnchors ? resolveStaffBuilderOriginalNotationControl(notationAnchors, applicable, point) : null;
    const actualEventId = originalNotationControl === null && onEventSelect ? resolveActualEventTarget(point) : null;
    const expandedNotationControl = originalNotationControl === null && actualEventId === null && notationAnchors
      ? resolveStaffBuilderExpandedNotationControl(notationAnchors, applicable, presentationScale, point) : null;
    const notationControl = originalNotationControl ?? expandedNotationControl;
    const eventId = notationControl === null && actualEventId === null && onEventSelect ? resolveEventTarget(point) : actualEventId;
    const offsetTicks = notationControl === null && eventId === null && onPositionSelect && renderResult && cursorStepDuration
      ? resolveStaffBuilderStepPositionTick(renderResult.anchors.timeline, point, stepDurationToTicks(cursorStepDuration))
      : null;
    return notationControl ? { kind: "notation", control: notationControl } : eventId ? { kind: "event", eventId } : offsetTicks !== null ? { kind: "position", offsetTicks } : null;
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
    const intent = gesture.intent;
    if (intent.kind === "notation") activateNotationControl(intent.control, true);
    else if (intent.kind === "event") {
      const eventId = intent.eventId;
      [...canvas.querySelectorAll<HTMLButtonElement>(".staff-builder-event-target")].find(({ dataset }) => dataset.eventId === eventId)?.focus({ preventScroll: true });
      activateEvent(eventId, true);
    } else onPositionSelect?.({ measureIndex, offsetTicks: intent.offsetTicks });
  };
  const handlePointerDown = (pointerEvent: ReactPointerEvent<HTMLDivElement>) => {
    const point = pointerToInternal(pointerEvent.clientX, pointerEvent.clientY);
    if (!point) { pointerGesture.current = null; return; }
    const intent = resolvePointerIntent(point);
    pointerGesture.current = intent ? { pointerId: pointerEvent.pointerId, startX: pointerEvent.clientX, startY: pointerEvent.clientY, intent } : null;
  };
  const handlePointerMove = (pointerEvent: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerEvent.pointerType && pointerEvent.pointerType !== "mouse") return;
    const point = pointerToInternal(pointerEvent.clientX, pointerEvent.clientY);
    const intent = point ? resolvePointerIntent(point) : null;
    setHoveredNotationControl(intent?.kind === "notation" ? intent.control : null);
  };
  const closeDuration = () => {
    const returnTo = durationEventId;
    setDurationEventId(null);
    if (returnTo) requestAnimationFrame(() => [...(canvasRef.current?.querySelectorAll<HTMLButtonElement>(".staff-builder-event-target") ?? [])].find(({ dataset }) => dataset.eventId === returnTo)?.focus({ preventScroll: true }));
  };
  const closeSettingWheel = () => {
    const kind = settingWheel?.kind;
    setSettingWheel(null);
    if (kind) requestAnimationFrame(() => canvasRef.current?.querySelector<HTMLButtonElement>(`[data-notation-control="${kind}"]`)?.focus({ preventScroll: true }));
  };
  const notationControlStyle = (anchor: CursorGeometry) => {
    const width = getStaffBuilderInternalTouchSize(anchor.width, presentationScale);
    const height = getStaffBuilderInternalTouchSize(anchor.height, presentationScale);
    return { left: anchor.x + anchor.width / 2 - width / 2, top: anchor.y + anchor.height / 2 - height / 2, width, height };
  };
  const notationTooltip = hoveredNotationControl === "trebleClef" ? "Use treble staff"
    : hoveredNotationControl === "grandStaff" ? "Use grand staff"
      : hoveredNotationControl === "bassClef" ? "Use bass staff"
        : hoveredNotationControl === "keySignature" ? "Change key signature"
          : hoveredNotationControl === "timeSignature" ? "Change time signature" : undefined;

  return (
    <section aria-describedby="staff-builder-score-semantics" aria-labelledby="staff-builder-score-view-title" className="staff-builder-score-view">
      <h3 className="sr-only" id="staff-builder-score-view-title">Measure {projection.measureNumber} of {score.measures.length}</h3>
      <div className="staff-builder-score-interaction-plane">
        <div className="staff-builder-notation-scroll" ref={scrollRef}>
        <div className="staff-builder-notation-presentation" style={{ width: (renderResult?.coordinateSpace.width ?? 760) * presentationScale, height: (renderResult?.coordinateSpace.height ?? 300) * presentationScale }}>
        <div className="staff-builder-notation-canvas" onPointerCancel={() => { pointerGesture.current = null; }} onPointerDown={handlePointerDown} onPointerLeave={() => setHoveredNotationControl(null)} onPointerMove={handlePointerMove} onPointerUp={(pointerEvent) => handlePointerUp(pointerEvent.pointerId, pointerEvent.clientX, pointerEvent.clientY)} ref={canvasRef} style={{ transform: `scale(${presentationScale})`, width: renderResult?.coordinateSpace.width ?? 760, height: renderResult?.coordinateSpace.height ?? 300 }} title={notationTooltip}>
          <div ref={notationRef} />
          {playbackGeometry && <div aria-hidden="true" className="staff-builder-playback-highlight" data-testid="staff-builder-playback-highlight" style={{ left: playbackGeometry.x, top: playbackGeometry.y, width: playbackGeometry.width, height: playbackGeometry.height }} />}
          {onInputModeChange && renderResult && ([
            ["treble", "trebleClef", "Use treble staff"],
            ["grand", "grandStaff", "Use grand staff"],
            ["bass", "bassClef", "Use bass staff"],
          ] as const).map(([mode, anchorName, label]) => <button aria-label={label} aria-pressed={inputMode === mode} className="staff-builder-notation-control staff-builder-routing-control" data-hovered={hoveredNotationControl === anchorName || undefined} data-notation-control={mode} key={mode} onClick={(event) => { if (event.detail === 0) onInputModeChange(mode); }} style={notationControlStyle(renderResult.anchors.notationControls[anchorName])} title={label} type="button" />)}
          {onKeyChange && renderResult && <button aria-expanded={settingWheel?.kind === "key"} aria-haspopup="dialog" aria-label={`Key signature: ${projection.keySignatureName}. Change key signature.`} className="staff-builder-notation-control staff-builder-context-control" data-hovered={hoveredNotationControl === "keySignature" || undefined} data-notation-control="key" onClick={(event) => { if (event.detail === 0) activateNotationControl("keySignature", false); }} style={notationControlStyle(renderResult.anchors.notationControls.keySignature)} title="Change key signature" type="button" />}
          {onTimeChange && renderResult && <button aria-expanded={settingWheel?.kind === "time"} aria-haspopup="dialog" aria-label={`Time signature: ${projection.timeSignature}. Change time signature.`} className="staff-builder-notation-control staff-builder-context-control" data-hovered={hoveredNotationControl === "timeSignature" || undefined} data-notation-control="time" onClick={(event) => { if (event.detail === 0) activateNotationControl("timeSignature", false); }} style={notationControlStyle(renderResult.anchors.notationControls.timeSignature)} title="Change time signature" type="button" />}
          {onEventSelect && authoritativeTargets.map(({ anchor, event }) => {
            const width = getStaffBuilderInternalTouchSize(anchor.width, presentationScale);
            const height = getStaffBuilderInternalTouchSize(anchor.height, presentationScale);
            return <button aria-label={eventAccessibleName(event, measureIndex)} className="staff-builder-event-target" data-event-id={event.id} key={event.id} onClick={(clickEvent) => {
              if (clickEvent.detail !== 0 && ignoredSyntheticClick.current !== null) { ignoredSyntheticClick.current = null; return; }
              activateEvent(event.id, clickEvent.detail !== 0);
            }} style={{ left: anchor.x + anchor.width / 2 - width / 2, top: anchor.y + anchor.height / 2 - height / 2, width, height }} type="button" />;
          })}
          {cursorGeometry && <div aria-hidden="true" className="staff-builder-capture-cursor" data-testid="staff-builder-capture-cursor" style={{ left: cursorGeometry.x, top: cursorGeometry.y, width: cursorGeometry.width, height: cursorGeometry.height }} />}
          {selectionGeometry && <div aria-hidden="true" className="staff-builder-selection-outline" data-testid="staff-builder-selection-outline" style={{ left: selectionGeometry.x, top: selectionGeometry.y, width: selectionGeometry.width, height: selectionGeometry.height }} />}
          {issueGeometry && <div aria-hidden="true" className="staff-builder-issue-outline" data-testid="staff-builder-issue-outline" style={{ left: issueGeometry.x, top: issueGeometry.y, width: issueGeometry.width, height: issueGeometry.height }}><span>!</span></div>}
          {(projection.boundaryTies ?? []).some(({ direction }) => direction === "incoming") && <div aria-hidden="true" className="staff-builder-boundary-tie staff-builder-boundary-tie-incoming">Tie in</div>}
          {(projection.boundaryTies ?? []).some(({ direction }) => direction === "outgoing") && <div aria-hidden="true" className="staff-builder-boundary-tie staff-builder-boundary-tie-outgoing">Tie out</div>}
        </div>
        </div>
        {onInputModeChange && <p className="staff-builder-touch-notation-hint">Tap a clef, key, or time signature to edit.</p>}
        </div>
      </div>
      {durationOverlay && selectedEvent && onAssignDuration && <StaffBuilderDurationWheel anchor={durationOverlay.anchor} bounds={durationOverlay.bounds} currentDuration={selectedEvent.rhythm.status === "final" ? selectedEvent.rhythm.duration : undefined} eventKind={selectedEvent.kind} key={durationEventId} openedByPointer={durationOpenedByPointer} onChoose={(duration) => {
        if (selectedEvent.rhythm.status === "final" && selectedEvent.rhythm.duration === duration) { closeDuration(); return; }
        if (onAssignDuration(duration)) closeDuration();
      }} onClose={closeDuration} onDelete={onDeleteEvent ? () => { if (onDeleteEvent()) closeDuration(); } : undefined} onToggleEventType={() => {
        const changed = selectedEvent.kind === "rest"
          ? onCaptureRestAsNote?.({ measureIndex, eventId: selectedEvent.id })
          : onConvertToRest?.(selectedEvent.rhythm.status === "final" ? selectedEvent.rhythm.duration : "quarter");
        if (changed) closeDuration();
      }} />}
      {settingOverlay && settingWheel?.kind === "key" && <StaffBuilderKeyWheel anchor={settingOverlay.anchor} bounds={settingOverlay.bounds} currentKey={projection.keySignatureId} key={`key-${measureIndex}`} openedByPointer={settingWheel.openedByPointer} onChoose={(key) => { onKeyChange?.(measureIndex, key); closeSettingWheel(); }} onClose={closeSettingWheel} />}
      {settingOverlay && settingWheel?.kind === "time" && <StaffBuilderTimeWheel anchor={settingOverlay.anchor} bounds={settingOverlay.bounds} currentTime={projection.timeSignature} key={`time-${measureIndex}`} openedByPointer={settingWheel.openedByPointer} onChoose={(time) => { onTimeChange?.(measureIndex, time); closeSettingWheel(); }} onClose={closeSettingWheel} />}
      <div aria-label={semanticDescription} className="sr-only" id="staff-builder-score-semantics" />
    </section>
  );
}

export function StaffBuilderScoreDetails({ score, measureIndex }: Readonly<{ score: StaffBuilderScoreV1; measureIndex: number }>) {
  const projection = projectStaffBuilderMeasure(score, measureIndex);
  return <details className="staff-builder-score-details">
    <summary>Score details</summary>
    <div aria-hidden="true" className="staff-builder-measure-summary">
      <p><strong>Measure {projection.measureNumber}.</strong> Effective key: {projection.keySignatureName}. Effective time signature: {projection.timeSignature}.</p>
      <p><strong>Treble:</strong> {projection.summary.treble}</p>
      <p><strong>Bass:</strong> {projection.summary.bass}</p>
      {(projection.boundaryTies ?? []).map((tie) => <p key={tie.tieId}>{tie.description} Tie {tie.tieId}, {tie.direction}, event {tie.eventId}.</p>)}
      {(projection.invalidEventIds ?? []).length > 0 && <p><strong>Invalid timing:</strong> {projection.invalidEventIds.length} event(s) begin outside this measure and are indicated at the boundary.</p>}
    </div>
  </details>;
}
