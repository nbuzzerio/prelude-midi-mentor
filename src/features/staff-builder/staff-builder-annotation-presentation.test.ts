import { describe, expect, it } from "vitest";
import { describeStaffBuilderAnnotation, STAFF_BUILDER_ANNOTATION_LAYER_LABELS } from "./staff-builder-annotation-presentation";

describe("Staff Builder annotation presentation", () => {
  it("provides shared human-readable labels", () => {
    expect(STAFF_BUILDER_ANNOTATION_LAYER_LABELS).toEqual({ "study-notes": "Study Notes", "practice-marks": "Practice Marks", bookmarks: "Bookmarks" });
    expect(describeStaffBuilderAnnotation({ id: "p", kind: "practice-mark", anchor: { kind: "measure", measureId: "m1" }, category: "hands-separate" })).toBe("Hands separate");
    expect(describeStaffBuilderAnnotation({ id: "o", kind: "practice-mark", anchor: { kind: "measure", measureId: "m1" }, category: "other", text: "Slowly" })).toBe("Slowly");
    expect(describeStaffBuilderAnnotation({ id: "b", kind: "bookmark", anchor: { kind: "measure", measureId: "m1" }, category: "revisit" })).toBe("Revisit");
  });
});
