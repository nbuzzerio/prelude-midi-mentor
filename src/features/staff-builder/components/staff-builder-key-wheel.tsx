import { MUSIC_KEYS, type MusicKeyId } from "@/lib/music/keys";
import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { getStaffBuilderRadialPlacement, getStaffBuilderRadialRingPosition, type StaffBuilderDisplayedAnchor, type StaffBuilderOverlayBounds } from "./staff-builder-radial-geometry";
import { STAFF_BUILDER_KEY_WHEEL_ORDER, STAFF_BUILDER_KEY_WHEEL_SIZE } from "./staff-builder-key-wheel-options";
import { useStaffBuilderRadialActivationGuard } from "./use-staff-builder-radial-activation-guard";
const SHORT_LABELS: Readonly<Record<MusicKeyId, string>> = {
  "c-major": "C", "a-minor": "Am", "g-major": "G", "e-minor": "Em", "d-major": "D", "b-minor": "Bm",
  "f-major": "F", "d-minor": "Dm", "b-flat-major": "B♭", "g-minor": "Gm", "e-flat-major": "E♭", "c-minor": "Cm",
};
const DEFINITIONS = new Map(MUSIC_KEYS.map((key) => [key.id, key]));

export function StaffBuilderKeyWheel({ anchor, bounds, currentKey, openedByPointer = false, onChoose, onClose }: Readonly<{
  anchor: StaffBuilderDisplayedAnchor;
  bounds: StaffBuilderOverlayBounds;
  currentKey: MusicKeyId;
  openedByPointer?: boolean;
  onChoose: (key: MusicKeyId) => void;
  onClose: () => void;
}>) {
  const [focusedKey, setFocusedKey] = useState(currentKey);
  const wheelRef = useRef<HTMLDivElement>(null);
  const activationGuard = useStaffBuilderRadialActivationGuard(openedByPointer);
  useLayoutEffect(() => { wheelRef.current?.querySelector<HTMLButtonElement>(`[data-key-id="${focusedKey}"]`)?.focus({ preventScroll: true }); }, [focusedKey]);
  const moveFocus = (key: string) => {
    const index = STAFF_BUILDER_KEY_WHEEL_ORDER.indexOf(focusedKey);
    const next = key === "ArrowLeft" || key === "ArrowUp" ? (index - 1 + 12) % 12
      : key === "ArrowRight" || key === "ArrowDown" ? (index + 1) % 12
        : key === "Home" ? 0 : key === "End" ? 11 : -1;
    if (next < 0) return false;
    setFocusedKey(STAFF_BUILDER_KEY_WHEEL_ORDER[next]!);
    return true;
  };
  return <div aria-label="Key signature choices" className="staff-builder-radial-wheel staff-builder-key-wheel" onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if ((event.target as HTMLElement).getAttribute("role") === "radio" && moveFocus(event.key)) event.preventDefault();
  }} onPointerDownCapture={activationGuard.onPointerDownCapture} ref={wheelRef} role="dialog" style={{ ...getStaffBuilderRadialPlacement(anchor, bounds, STAFF_BUILDER_KEY_WHEEL_SIZE), width: STAFF_BUILDER_KEY_WHEEL_SIZE, height: STAFF_BUILDER_KEY_WHEEL_SIZE }}>
    <div aria-label="Choose key signature" role="radiogroup">
      {STAFF_BUILDER_KEY_WHEEL_ORDER.map((keyId, index) => <button aria-checked={currentKey === keyId} aria-label={DEFINITIONS.get(keyId)?.name} className="staff-builder-radial-option" data-key-id={keyId} key={keyId} onClick={(event) => activationGuard.activate(event, () => onChoose(keyId))} onFocus={() => setFocusedKey(keyId)} role="radio" style={{ ...getStaffBuilderRadialRingPosition(index, 12, 112, STAFF_BUILDER_KEY_WHEEL_SIZE), width: 48, height: 48 }} tabIndex={focusedKey === keyId ? 0 : -1} title={DEFINITIONS.get(keyId)?.name} type="button">{SHORT_LABELS[keyId]}</button>)}
    </div>
    <button aria-label="Close key signature choices" className="staff-builder-radial-close" onClick={(event) => activationGuard.activate(event, onClose)} title="Close" type="button"><X aria-hidden="true" /></button>
  </div>;
}
