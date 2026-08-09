import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { STAFF_BUILDER_TIME_SIGNATURES, type StaffBuilderTimeSignature } from "../staff-builder-time";
import { getStaffBuilderRadialPlacement, getStaffBuilderRadialRingPosition, type StaffBuilderDisplayedAnchor, type StaffBuilderOverlayBounds } from "./staff-builder-radial-geometry";
import { useStaffBuilderRadialActivationGuard } from "./use-staff-builder-radial-activation-guard";

export const STAFF_BUILDER_TIME_WHEEL_SIZE = 268;

export function StaffBuilderTimeWheel({ anchor, bounds, currentTime, openedByPointer = false, onChoose, onClose }: Readonly<{
  anchor: StaffBuilderDisplayedAnchor;
  bounds: StaffBuilderOverlayBounds;
  currentTime: StaffBuilderTimeSignature;
  openedByPointer?: boolean;
  onChoose: (time: StaffBuilderTimeSignature) => void;
  onClose: () => void;
}>) {
  const [focusedTime, setFocusedTime] = useState(currentTime);
  const wheelRef = useRef<HTMLDivElement>(null);
  const activationGuard = useStaffBuilderRadialActivationGuard(openedByPointer);
  useLayoutEffect(() => { wheelRef.current?.querySelector<HTMLButtonElement>(`[data-time="${focusedTime}"]`)?.focus({ preventScroll: true }); }, [focusedTime]);
  const moveFocus = (key: string) => {
    const index = STAFF_BUILDER_TIME_SIGNATURES.indexOf(focusedTime);
    const next = key === "ArrowLeft" || key === "ArrowUp" ? (index - 1 + 4) % 4
      : key === "ArrowRight" || key === "ArrowDown" ? (index + 1) % 4
        : key === "Home" ? 0 : key === "End" ? 3 : -1;
    if (next < 0) return false;
    setFocusedTime(STAFF_BUILDER_TIME_SIGNATURES[next]!);
    return true;
  };
  return <div aria-label="Time signature choices" className="staff-builder-radial-wheel staff-builder-time-wheel" onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if ((event.target as HTMLElement).getAttribute("role") === "radio" && moveFocus(event.key)) event.preventDefault();
  }} onPointerDownCapture={activationGuard.onPointerDownCapture} ref={wheelRef} role="dialog" style={{ ...getStaffBuilderRadialPlacement(anchor, bounds, STAFF_BUILDER_TIME_WHEEL_SIZE), width: STAFF_BUILDER_TIME_WHEEL_SIZE, height: STAFF_BUILDER_TIME_WHEEL_SIZE }}>
    <div aria-label="Choose time signature" role="radiogroup">
      {STAFF_BUILDER_TIME_SIGNATURES.map((time, index) => { const [top, bottom] = time.split("/"); return <button aria-checked={currentTime === time} aria-label={`Time signature ${time}`} className="staff-builder-radial-option staff-builder-time-option" data-time={time} key={time} onClick={(event) => activationGuard.activate(event, () => onChoose(time))} onFocus={() => setFocusedTime(time)} role="radio" style={{ ...getStaffBuilderRadialRingPosition(index, 4, 88, STAFF_BUILDER_TIME_WHEEL_SIZE), width: 48, height: 48 }} tabIndex={focusedTime === time ? 0 : -1} title={`Time signature ${time}`} type="button"><span>{top}</span><span>{bottom}</span></button>; })}
    </div>
    <button aria-label="Close time signature choices" className="staff-builder-radial-close" onClick={(event) => activationGuard.activate(event, onClose)} title="Close" type="button"><X aria-hidden="true" /></button>
  </div>;
}
