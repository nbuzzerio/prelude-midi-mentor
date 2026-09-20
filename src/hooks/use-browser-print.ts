import { useEffect, useRef } from "react";

/** Runs the browser print lifecycle after feature-owned printable content has mounted. */
export function useBrowserPrint(active: boolean, onComplete: () => void) {
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    if (!active) return;
    let completed = false;
    let fallbackTimer: number | undefined;
    const finish = () => {
      if (completed) return;
      completed = true;
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      completeRef.current();
    };
    window.addEventListener("afterprint", finish, { once: true });
    const printTimer = window.setTimeout(() => {
      window.print();
      fallbackTimer = window.setTimeout(finish, 1_000);
    }, 0);
    return () => {
      window.clearTimeout(printTimer);
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      window.removeEventListener("afterprint", finish);
    };
  }, [active]);
}
