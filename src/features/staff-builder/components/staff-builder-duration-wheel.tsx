import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { STAFF_BUILDER_DURATIONS, type StaffBuilderDuration } from "../staff-builder-time";
import { StaffBuilderMusicGlyph } from "./staff-builder-music-glyph";
import { getStaffBuilderDurationRingPosition, getStaffBuilderDurationWheelPlacement, type StaffBuilderDisplayedAnchor, type StaffBuilderOverlayBounds } from "./staff-builder-duration-wheel-geometry";

const LABELS: Readonly<Record<StaffBuilderDuration, string>> = {
  whole: "Whole", "dotted-half": "Dotted half", half: "Half", "dotted-quarter": "Dotted quarter",
  quarter: "Quarter", "dotted-eighth": "Dotted eighth", eighth: "Eighth", sixteenth: "Sixteenth",
};
export function StaffBuilderDurationWheel({ anchor, bounds, eventKind, currentDuration, onChoose, onToggleEventType = () => undefined, onClose }: Readonly<{
  anchor: StaffBuilderDisplayedAnchor;
  bounds: StaffBuilderOverlayBounds;
  eventKind: "notes" | "rest";
  currentDuration?: StaffBuilderDuration;
  onChoose: (duration: StaffBuilderDuration) => void;
  onToggleEventType?: () => void;
  onClose: () => void;
}>) {
  const placement = getStaffBuilderDurationWheelPlacement(anchor, bounds);
  const [focusedDuration, setFocusedDuration] = useState<StaffBuilderDuration>(currentDuration ?? "quarter");
  const wheelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { [...(wheelRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])].find(({ dataset }) => dataset.duration === focusedDuration)?.focus({ preventScroll: true }); }, [focusedDuration]);
  const handleDurationKey = (key: string) => {
    const index = STAFF_BUILDER_DURATIONS.indexOf(focusedDuration);
    const nextIndex = key === "ArrowLeft" || key === "ArrowUp" ? Math.max(0, index - 1)
      : key === "ArrowRight" || key === "ArrowDown" ? Math.min(STAFF_BUILDER_DURATIONS.length - 1, index + 1)
        : key === "Home" ? 0 : key === "End" ? STAFF_BUILDER_DURATIONS.length - 1 : -1;
    if (nextIndex >= 0) setFocusedDuration(STAFF_BUILDER_DURATIONS[nextIndex] ?? focusedDuration);
    else if (key === "Enter" || key === " ") onChoose(focusedDuration);
    else return false;
    return true;
  };
  const duration = currentDuration ?? "quarter";
  const oppositeFamily = eventKind === "rest" ? "note" : "rest";
  return <div className="staff-builder-duration-wheel" data-testid="staff-builder-duration-wheel" onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if ((event.target as HTMLElement).getAttribute("role") === "radio" && handleDurationKey(event.key)) event.preventDefault();
  }} ref={wheelRef} style={placement}>
    <div aria-label={`Duration for selected ${eventKind === "rest" ? "rest" : "note or chord"}`} className="staff-builder-duration-options" role="radiogroup">
      {STAFF_BUILDER_DURATIONS.map((item, index) => {
        const position = getStaffBuilderDurationRingPosition(index);
        return <button aria-checked={currentDuration === item} aria-label={`${LABELS[item]}-${eventKind === "rest" ? "rest" : "note"} duration`} className="staff-builder-duration-option" data-duration={item} key={item} onClick={() => onChoose(item)} onFocus={() => setFocusedDuration(item)} role="radio" style={{ ...position, width: 48, height: 48 }} tabIndex={focusedDuration === item ? 0 : -1} title={`${LABELS[item]} ${eventKind === "rest" ? "rest" : "note"}`} type="button"><StaffBuilderMusicGlyph family={eventKind === "rest" ? "rest" : "note"} kind={item} /></button>;
      })}
    </div>
    <button aria-label={eventKind === "rest" ? "Replace rest with notes" : "Convert note or chord to rest"} className="staff-builder-duration-center" onClick={onToggleEventType} title={eventKind === "rest" ? "Enter replacement pitches" : "Convert to rest"} type="button"><StaffBuilderMusicGlyph family={oppositeFamily} kind={duration} /></button>
    <button aria-label="Close duration choices" className="staff-builder-duration-close" onClick={onClose} title="Close" type="button"><X aria-hidden="true" /></button>
  </div>;
}
