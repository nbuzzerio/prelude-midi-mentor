import { Redo2, Undo2 } from "lucide-react";

export function StaffBuilderHistoryControls({ canRedo, canUndo, onRedo, onUndo }: Readonly<{
  canRedo: boolean;
  canUndo: boolean;
  onRedo: () => unknown;
  onUndo: () => unknown;
}>) {
  return <div aria-label="Score edit history" className="staff-builder-history-controls" role="group">
    <button aria-label="Undo last score edit" disabled={!canUndo} onClick={onUndo} title="Undo last score edit" type="button"><Undo2 aria-hidden="true" /></button>
    <button aria-label="Redo last score edit" disabled={!canRedo} onClick={onRedo} title="Redo last score edit" type="button"><Redo2 aria-hidden="true" /></button>
  </div>;
}
