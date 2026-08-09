import { CornerDownRight, X } from "lucide-react";
import { useLayoutEffect, useRef, type RefObject } from "react";
import type { StaffBuilderPendingCapture } from "../staff-builder-capture";
import { StaffBuilderVirtualKeyboard } from "./staff-builder-virtual-keyboard";

export function StaffBuilderMobileKeyboardSheet({ pending, onVirtualPitchToggle, onLock, onClose, lockDisabled = false, scoreRegionRef }: Readonly<{
  pending: StaffBuilderPendingCapture;
  onVirtualPitchToggle: (midiNumber: number) => void;
  onLock: () => void;
  onClose: () => void;
  lockDisabled?: boolean;
  scoreRegionRef: RefObject<HTMLElement | null>;
}>) {
  const sheetRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const scoreRegion = scoreRegionRef.current;
    const sheet = sheetRef.current;
    if (!scoreRegion || !sheet) return;
    const viewportBottom = window.visualViewport?.height ?? window.innerHeight;
    const visibleBottom = viewportBottom - sheet.getBoundingClientRect().height;
    if (scoreRegion.getBoundingClientRect().bottom > visibleBottom && typeof scoreRegion.scrollIntoView === "function") scoreRegion.scrollIntoView({ block: "nearest" });
  }, [scoreRegionRef]);

  return <section aria-label="Virtual keyboard" className="staff-builder-mobile-keyboard-sheet" ref={sheetRef}>
    <div className="staff-builder-mobile-keyboard-actions">
      <button aria-label="Close virtual keyboard" onClick={onClose} ref={closeRef} title="Close virtual keyboard" type="button"><X aria-hidden="true" /></button>
      <button aria-label="Lock pitches and continue" disabled={lockDisabled} onClick={onLock} title="Lock pitches and continue" type="button"><CornerDownRight aria-hidden="true" /><span>Enter</span></button>
    </div>
    <div className="staff-builder-mobile-keyboard-keys"><StaffBuilderVirtualKeyboard onVirtualPitchToggle={onVirtualPitchToggle} pending={pending} /></div>
  </section>;
}
