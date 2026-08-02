import { useEffect, useRef } from "react";

type FocusStaffControlProps = Readonly<{
  isFocusMode: boolean;
  onToggle: () => void;
}>;

export default function FocusStaffControl({
  isFocusMode,
  onToggle,
}: FocusStaffControlProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isFocusMode) {
      buttonRef.current?.focus();
    }
  }, [isFocusMode]);

  return (
    <button
      aria-keyshortcuts="F Escape"
      aria-pressed={isFocusMode}
      className="rounded-lg border border-sky-400/50 bg-zinc-950/90 px-3 py-2 text-sm font-semibold text-sky-100 shadow-sm hover:bg-sky-400/15"
      onClick={onToggle}
      ref={buttonRef}
      type="button"
    >
      {isFocusMode ? "Exit Focus Staff" : "Focus Staff"}
    </button>
  );
}
