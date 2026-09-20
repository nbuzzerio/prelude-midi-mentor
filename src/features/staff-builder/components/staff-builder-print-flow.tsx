import { useState } from "react";
import { useBrowserPrint } from "@/hooks/use-browser-print";
import type { StaffBuilderScore } from "../staff-builder-types";
import { StaffBuilderPrintOptions, type StaffBuilderPrintRequest } from "./staff-builder-print-options";
import { StaffBuilderPrintScore } from "./staff-builder-print-score";

export function StaffBuilderPrintFlow({ onClose, score }: Readonly<{ onClose: () => void; score: StaffBuilderScore }>) {
  const [request, setRequest] = useState<StaffBuilderPrintRequest | null>(null);
  useBrowserPrint(request !== null, onClose);

  return request
    ? <StaffBuilderPrintScore measureIndexes={request.measureIndexes} measuresPerLine={request.measuresPerLine} score={score} />
    : <StaffBuilderPrintOptions measureCount={score.measures.length} onCancel={onClose} onPrint={setRequest} />;
}
