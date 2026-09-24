import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export default function WeeklyPracticeDialog({ children, description, footer, onClose, title }: Readonly<{ children: ReactNode; description: string; footer: ReactNode; onClose: () => void; title: string }>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId(); const descriptionId = "weekly-import-description";
  useEffect(() => titleRef.current?.focus(), []);
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button, textarea, input:not([disabled]), select, a[href], [tabindex]:not([tabindex="-1"])') ?? [])];
    const first = controls[0]; const last = controls.at(-1); if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === titleRef.current || document.activeElement === first)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6">
    <div aria-describedby={descriptionId} aria-labelledby={titleId} aria-modal="true" className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-white/15 bg-zinc-950 p-4 shadow-2xl sm:p-6" onKeyDown={keyDown} ref={dialogRef} role="dialog">
      <header><h2 className="text-xl font-bold" id={titleId} ref={titleRef} tabIndex={-1}>{title}</h2><p className="mt-1 text-sm text-zinc-400" id={descriptionId}>{description}</p></header>
      <div className="mt-4 min-h-0 overflow-y-auto pr-1">{children}</div>
      <footer className="mt-4 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">{footer}</footer>
    </div>
  </div>;
}
