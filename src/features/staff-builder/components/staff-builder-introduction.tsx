import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

export function StaffBuilderIntroduction({ onClose, returnFocusRef }: Readonly<{
  onClose: (dismiss: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}>) {
  const [dismiss, setDismiss] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const fallbackFocus = returnFocusRef.current;
    closeButtonRef.current?.focus();
    return () => {
      const focusTarget = previouslyFocused === document.body ? fallbackFocus : previouslyFocused;
      focusTarget?.focus();
    };
  }, [returnFocusRef]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose(dismiss);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button, input") ?? [])
      .filter((element) => !element.hasAttribute("disabled"));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return (
    <div aria-labelledby="staff-builder-introduction-title" aria-modal="true" className="staff-builder-dialog-backdrop" onKeyDown={handleKeyDown} ref={dialogRef} role="dialog">
      <section className="staff-builder-dialog">
        <h2 className="text-xl font-semibold" id="staff-builder-introduction-title">About Staff Builder</h2>
        <p>Staff Builder is more involved than Prelude’s other modes. It helps learners create a simplified reference version of their own learning material.</p>
        <p>The workflow uses Capture Notes followed by Rhythm Correction. Playback is mechanically precise and emotionally neutral—a useful baseline, not an ideal expressive performance.</p>
        <p>Pieces are stored only in this browser and device. They are not synced, and clearing browser data may remove them.</p>
        <label className="flex items-center gap-2">
          <input checked={dismiss} onChange={(event) => setDismiss(event.target.checked)} type="checkbox" />
          Don’t show this again
        </label>
        <button className="rounded bg-sky-500 px-4 py-2 font-semibold text-white" onClick={() => onClose(dismiss)} ref={closeButtonRef} type="button">Begin</button>
      </section>
    </div>
  );
}
