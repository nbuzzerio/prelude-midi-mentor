import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PracticeDiagnosticChips } from "./practice-diagnostic-chips";

afterEach(cleanup);

describe("PracticeDiagnosticChips", () => {
  it("renders authoritative text and distinct accessible semantics without relying on color", () => {
    render(<PracticeDiagnosticChips chips={[
      { id: "pitch-problem", kind: "problem", label: "Pitch", count: 1, accessibleText: "Pitch problem evidence: one mismatch" },
      { id: "melody-pitch-metric", kind: "metric", label: "Pitch", value: "82%", accessibleText: "Pitch metric: 82 percent" },
    ]} />);
    expect(screen.getByLabelText("Pitch problem evidence: one mismatch").textContent).toBe("Pitch ×1");
    expect(screen.getByLabelText("Pitch metric: 82 percent").textContent).toBe("Pitch 82%");
    expect(screen.getByLabelText("Pitch problem evidence: one mismatch").dataset.diagnosticKind).toBe("problem");
    expect(screen.getByLabelText("Pitch metric: 82 percent").dataset.diagnosticKind).toBe("metric");
  });
});
