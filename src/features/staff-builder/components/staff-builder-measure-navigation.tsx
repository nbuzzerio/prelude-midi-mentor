import { useRef, useState } from "react";

export function StaffBuilderMeasureNavigation({ measureIndex, measureCount, disabled = false, onNavigate }: Readonly<{
  measureIndex: number;
  measureCount: number;
  disabled?: boolean;
  onNavigate: (measureIndex: number) => unknown;
}>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (disabled && open) setOpen(false);
  const closePicker = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const validationTitle = disabled ? "Measure navigation is unavailable during Structural correction." : undefined;

  return <nav aria-label="Measure navigation" className="staff-builder-measure-navigation" onKeyDown={(event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closePicker();
    }
  }}>
    <div className="staff-builder-measure-navigation-controls">
      <button aria-label="Previous Measure" className="staff-builder-score-navigation-button" disabled={disabled || measureIndex === 0} onClick={() => onNavigate(measureIndex - 1)} title={validationTitle} type="button">Previous</button>
      <button
        aria-controls="staff-builder-measure-picker"
        aria-expanded={open}
        aria-label={`Current measure: Measure ${measureIndex + 1} of ${measureCount}`}
        className="staff-builder-measure-selector"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        title={validationTitle}
        type="button"
      >Measure {measureIndex + 1} of {measureCount} <span aria-hidden="true">▾</span></button>
      <button aria-label="Next Measure" className="staff-builder-score-navigation-button" disabled={disabled || measureIndex >= measureCount - 1} onClick={() => onNavigate(measureIndex + 1)} title={validationTitle} type="button">Next</button>
    </div>
    {open && <ul aria-label="Choose a measure" className="staff-builder-measure-picker" id="staff-builder-measure-picker">
      {Array.from({ length: measureCount }, (_value, index) => <li key={index}>
        <button aria-current={index === measureIndex ? "true" : undefined} className="staff-builder-measure-picker-option" onClick={() => { onNavigate(index); closePicker(); }} type="button">Measure {index + 1}</button>
      </li>)}
    </ul>}
  </nav>;
}
