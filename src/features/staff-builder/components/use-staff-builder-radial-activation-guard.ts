import { useState, type MouseEvent, type PointerEventHandler } from "react";

export function useStaffBuilderRadialActivationGuard(openedByPointer: boolean) {
  const [pointerArmed, setPointerArmed] = useState(!openedByPointer);
  const onPointerDownCapture: PointerEventHandler<HTMLElement> = () => setPointerArmed(true);
  const activate = (event: MouseEvent<HTMLElement>, action: () => void) => {
    if (event.detail !== 0 && !pointerArmed) return;
    action();
  };
  return { activate, onPointerDownCapture };
}
