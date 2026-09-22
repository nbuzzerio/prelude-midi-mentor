import { describe, expect, it } from "vitest";
import type { StaffBuilderScore } from "./staff-builder-types";
import { sortStaffBuilderLibraryPieces } from "./staff-builder-library-sorting";

const piece = (id: string, title: string, updatedAt: string): StaffBuilderScore => ({
  schemaVersion: 3, annotations: [], id, title, createdAt: "2026-01-01T00:00:00.000Z", updatedAt,
  tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [], measures: [{ id: `m-${id}`, events: [] }],
});

describe("Staff Builder library sorting", () => {
  const alpha10 = piece("alpha-10", "Etude 10", "2026-02-01T00:00:00.000Z");
  const alpha2 = piece("alpha-2", "etude 2", "2026-03-01T00:00:00.000Z");
  const nocturne = piece("nocturne", "Nocturne", "2026-01-01T00:00:00.000Z");

  it("sorts alphabetically with human-friendly numeric comparison and deterministic IDs", () => {
    expect(sortStaffBuilderLibraryPieces({ pieces: [nocturne, alpha10, alpha2], practiceMetadataByPieceId: {} }, "alphabetical").map(({ id }) => id))
      .toEqual(["alpha-2", "alpha-10", "nocturne"]);
  });

  it("sorts recently updated newest first", () => {
    expect(sortStaffBuilderLibraryPieces({ pieces: [nocturne, alpha10, alpha2], practiceMetadataByPieceId: {} }, "recently-updated").map(({ id }) => id))
      .toEqual(["alpha-2", "alpha-10", "nocturne"]);
  });

  it("puts actual practice newest first and never-played pieces afterward using recently-updated fallback", () => {
    const library = { pieces: [alpha2, nocturne, alpha10], practiceMetadataByPieceId: {
      nocturne: { lastPracticedAt: "2026-05-01T00:00:00.000Z" },
      "alpha-10": { lastPracticedAt: "2026-04-01T00:00:00.000Z" },
    } };
    expect(sortStaffBuilderLibraryPieces(library, "recently-played").map(({ id }) => id))
      .toEqual(["nocturne", "alpha-10", "alpha-2"]);
  });

  it("does not mutate persisted source order", () => {
    const pieces = [nocturne, alpha10, alpha2];
    expect(sortStaffBuilderLibraryPieces({ pieces, practiceMetadataByPieceId: {} }, "recently-played")).not.toBe(pieces);
    expect(pieces.map(({ id }) => id)).toEqual(["nocturne", "alpha-10", "alpha-2"]);
  });
});
