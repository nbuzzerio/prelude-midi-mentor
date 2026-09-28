export const STAFF_BUILDER_CLEFS = ["treble", "bass"] as const;
export type StaffBuilderClef = (typeof STAFF_BUILDER_CLEFS)[number];

export const DEFAULT_STAFF_BUILDER_CLEFS = Object.freeze({ treble: "treble", bass: "bass" } as const);

export function isStaffBuilderClef(value: unknown): value is StaffBuilderClef {
  return value === "treble" || value === "bass";
}
