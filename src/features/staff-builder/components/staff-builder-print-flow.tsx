import { useEffect, useState } from "react";
import type { StaffBuilderScore } from "../staff-builder-types";
import { StaffBuilderPrintOptions, type StaffBuilderPrintRequest } from "./staff-builder-print-options";
import { StaffBuilderPrintScore } from "./staff-builder-print-score";

export function StaffBuilderPrintFlow({ onClose, score }: Readonly<{ onClose: () => void; score: StaffBuilderScore }>) {
  const [request, setRequest] = useState<StaffBuilderPrintRequest | null>(null);
  useEffect(() => {
    if (!request) return;
    const finish = () => onClose();
    window.addEventListener("afterprint", finish, { once: true });
    let fallbackTimer: number | undefined;
    const printTimer = window.setTimeout(() => {
      window.print();
      fallbackTimer = window.setTimeout(finish, 1_000);
    }, 0);
    return () => {
      window.clearTimeout(printTimer);
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      window.removeEventListener("afterprint", finish);
    };
  }, [onClose, request]);

  return request
    ? <StaffBuilderPrintScore measureIndexes={request.measureIndexes} measuresPerLine={request.measuresPerLine} score={score} />
    : <StaffBuilderPrintOptions measureCount={score.measures.length} onCancel={onClose} onPrint={setRequest} />;
}
