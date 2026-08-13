import { describe, expect, it } from "vitest";
import { filterStaffBuilderAnnotationsByLayers, getStaffBuilderAnnotationLayer } from "./staff-builder-annotation-layers";
import type { StaffBuilderAnnotation } from "./staff-builder-types";

const annotations: readonly StaffBuilderAnnotation[] = [
  { id: "note", kind: "study-note", anchor: { kind: "measure", measureId: "measure" }, text: "Listen." },
  { id: "practice", kind: "practice-mark", anchor: { kind: "measure", measureId: "measure" }, category: "rhythm" },
  { id: "bookmark", kind: "bookmark", anchor: { kind: "measure", measureId: "measure" }, category: "revisit" },
];

describe("Staff Builder annotation layers", () => {
  it("maps each Phase 1 annotation kind to its presentation layer", () => {
    expect(annotations.map(getStaffBuilderAnnotationLayer)).toEqual(["study-notes", "practice-marks", "bookmarks"]);
  });

  it("filters presentation without changing annotation data", () => {
    const visible = new Set(["study-notes", "bookmarks"] as const);
    expect(filterStaffBuilderAnnotationsByLayers(annotations, visible).map(({ id }) => id)).toEqual(["note", "bookmark"]);
    expect(annotations).toHaveLength(3);
  });
});
