import type { StaffBuilderLibrary } from "./persistence/staff-builder-schema";
import type { StaffBuilderScore } from "./staff-builder-types";

export type StaffBuilderLibrarySort = "recently-played" | "recently-updated" | "alphabetical";

const titleCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function compareTitle(left: StaffBuilderScore, right: StaffBuilderScore): number {
  return titleCollator.compare(left.title, right.title) || left.id.localeCompare(right.id);
}

function compareRecentlyUpdated(left: StaffBuilderScore, right: StaffBuilderScore): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || compareTitle(left, right);
}

export function sortStaffBuilderLibraryPieces(
  library: Pick<StaffBuilderLibrary, "pieces" | "practiceMetadataByPieceId">,
  sort: StaffBuilderLibrarySort,
): readonly StaffBuilderScore[] {
  return [...library.pieces].sort((left, right) => {
    if (sort === "alphabetical") return compareTitle(left, right);
    if (sort === "recently-updated") return compareRecentlyUpdated(left, right);
    const leftPracticedAt = library.practiceMetadataByPieceId[left.id]?.lastPracticedAt;
    const rightPracticedAt = library.practiceMetadataByPieceId[right.id]?.lastPracticedAt;
    if (leftPracticedAt && rightPracticedAt) {
      return Date.parse(rightPracticedAt) - Date.parse(leftPracticedAt) || compareRecentlyUpdated(left, right);
    }
    if (leftPracticedAt) return -1;
    if (rightPracticedAt) return 1;
    return compareRecentlyUpdated(left, right);
  });
}
