import { useEffect, useRef } from "react";

let titleOwner: { token: symbol; original: string; applied: string } | null = null;

/** Runs the browser print lifecycle after feature-owned printable content has mounted. */
export function useBrowserPrint(active: boolean, onComplete: () => void, suggestedTitle?: string) {
  const completeRef = useRef(onComplete);
  const titleRef = useRef(suggestedTitle);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => { titleRef.current = suggestedTitle; }, [suggestedTitle]);
  useEffect(() => {
    if (!active) return;
    let completed = false;
    const token = Symbol("print");
    let fallbackTimer: number | undefined;
    const restore = () => {
      if (titleOwner?.token !== token) return;
      if (document.title === titleOwner.applied) document.title = titleOwner.original;
      titleOwner = null;
    };
    const finish = () => {
      if (completed) return;
      completed = true;
      window.clearTimeout(printTimer);
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      restore();
      completeRef.current();
    };
    const media = window.matchMedia?.("print");
    const mediaChange = (event: MediaQueryListEvent) => { if (!event.matches) finish(); };
    window.addEventListener("afterprint", finish, { once: true });
    window.addEventListener("pagehide", finish);
    window.addEventListener("pageshow", finish);
    document.addEventListener("freeze", finish);
    media?.addEventListener?.("change", mediaChange);
    const printTimer = window.setTimeout(() => {
      if (completed) return;
      const title = titleRef.current;
      if (title) {
        const original = titleOwner && document.title === titleOwner.applied ? titleOwner.original : document.title;
        titleOwner = { token, original, applied: title };
        document.title = title;
      }
      try { window.print(); } catch { finish(); }
      // afterprint may fire synchronously inside print(), including cancellation.
      if (!completed) fallbackTimer = window.setTimeout(finish, 1_000);
    }, 0);
    return () => {
      completed = true;
      window.clearTimeout(printTimer);
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      window.removeEventListener("afterprint", finish);
      window.removeEventListener("pagehide", finish);
      window.removeEventListener("pageshow", finish);
      document.removeEventListener("freeze", finish);
      media?.removeEventListener?.("change", mediaChange);
      restore();
    };
  }, [active]);
}
