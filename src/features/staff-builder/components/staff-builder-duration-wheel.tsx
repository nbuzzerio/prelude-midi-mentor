import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { STAFF_BUILDER_DURATIONS, type StaffBuilderDuration } from "../staff-builder-time";
import type { StaffBuilderEventAnchor } from "../notation/render-staff-builder-measure";
import { StaffBuilderMusicGlyph } from "./staff-builder-music-glyph";

const LABELS: Readonly<Record<StaffBuilderDuration, string>> = {
  whole: "Whole", "dotted-half": "Dotted half", half: "Half", "dotted-quarter": "Dotted quarter",
  quarter: "Quarter", "dotted-eighth": "Dotted eighth", eighth: "Eighth", sixteenth: "Sixteenth",
};
const WIDTH = 236;
const HEIGHT = 116;

function getStaffBuilderDurationWheelPlacement(anchor: StaffBuilderEventAnchor, space: Readonly<{ width: number; height: number }>, presentationScale: number) {
  const scale = presentationScale > 0 ? presentationScale : 1;
  const width = WIDTH / scale;
  const height = HEIGHT / scale;
  const horizontalGap = 10 / scale;
  const preferredLeft = anchor.x + anchor.width + horizontalGap;
  const left = preferredLeft + width <= space.width ? preferredLeft : anchor.x - width - horizontalGap;
  return { left: Math.max(0, Math.min(left, space.width - width)), top: Math.max(0, Math.min(anchor.y - 18 / scale, space.height - height)) };
}

export function StaffBuilderDurationWheel({ anchor, coordinateSpace, eventKind, currentDuration, onChoose, onClose, presentationScale = 1 }: Readonly<{
  anchor: StaffBuilderEventAnchor;
  coordinateSpace: Readonly<{ width: number; height: number }>;
  eventKind: "notes" | "rest";
  currentDuration?: StaffBuilderDuration;
  onChoose: (duration: StaffBuilderDuration) => void;
  onClose: () => void;
  presentationScale?: number;
}>) {
  const safeScale = presentationScale > 0 ? presentationScale : 1;
  const placement = getStaffBuilderDurationWheelPlacement(anchor, coordinateSpace, safeScale);
  const [focusedDuration, setFocusedDuration] = useState<StaffBuilderDuration>(currentDuration ?? "quarter");
  const wheelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { [...(wheelRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])].find(({ dataset }) => dataset.duration === focusedDuration)?.focus({ preventScroll: true }); }, [focusedDuration]);
  const focusDuration = (duration: StaffBuilderDuration) => setFocusedDuration(duration);
  const handleDurationKey = (key: string) => {
    const index = STAFF_BUILDER_DURATIONS.indexOf(focusedDuration);
    if (key === "ArrowLeft" || key === "ArrowUp") focusDuration(STAFF_BUILDER_DURATIONS[Math.max(0, index - 1)] ?? focusedDuration);
    else if (key === "ArrowRight" || key === "ArrowDown") focusDuration(STAFF_BUILDER_DURATIONS[Math.min(STAFF_BUILDER_DURATIONS.length - 1, index + 1)] ?? focusedDuration);
    else if (key === "Home") focusDuration(STAFF_BUILDER_DURATIONS[0] ?? focusedDuration);
    else if (key === "End") focusDuration(STAFF_BUILDER_DURATIONS.at(-1) ?? focusedDuration);
    else if (key === "Enter" || key === " ") onChoose(focusedDuration);
    else return false;
    return true;
  };
  return <div className="staff-builder-duration-wheel" onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if ((event.target as HTMLElement).getAttribute("role") === "radio" && handleDurationKey(event.key)) event.preventDefault();
  }} ref={wheelRef} style={{ ...placement, transform: `scale(${1 / safeScale})`, transformOrigin: "top left" }}>
    <button aria-label="Close duration choices" className="staff-builder-duration-close" onClick={onClose} title="Close" type="button"><X aria-hidden="true" /></button>
    <div aria-label={`Duration for selected ${eventKind === "rest" ? "rest" : "note or chord"}`} className="staff-builder-duration-options" role="radiogroup" style={{ display: "contents" }}>
      {STAFF_BUILDER_DURATIONS.map((duration) => <button aria-checked={currentDuration === duration} aria-label={`${LABELS[duration]}-${eventKind === "rest" ? "rest" : "note"} duration`} data-duration={duration} key={duration} onClick={() => onChoose(duration)} onFocus={() => setFocusedDuration(duration)} role="radio" tabIndex={focusedDuration === duration ? 0 : -1} title={`${LABELS[duration]} ${eventKind === "rest" ? "rest" : "note"}`} type="button"><StaffBuilderMusicGlyph family={eventKind === "rest" ? "rest" : "note"} kind={duration} /></button>)}
    </div>
  </div>;
}
