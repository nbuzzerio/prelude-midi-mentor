import { describe, expect, it, vi } from "vitest";
import type { PracticeSessionLibrary } from "../practice-session-types";
import { MINIMAL_WEEKLY_PRACTICE_EXAMPLE, REALISTIC_WEEKLY_PRACTICE_EXAMPLE } from "./weekly-practice-examples";
import { applyWeeklyPracticeImport, practiceSessionPresetNameKey, prepareWeeklyPracticeImport, validateWeeklyPracticeImportNames } from "./weekly-practice-import";

const empty: PracticeSessionLibrary = { schemaVersion: 2, presets: [], curricula: [], lastUsedPresetId: null };
const ids = (...values: string[]) => vi.fn(() => values.shift() ?? "unused-id");

describe("Weekly Practice import service", () => {
  it("prepares without mutation and atomically appends practice presets and rest metadata", () => {
    const library = structuredClone(empty); const before = structuredClone(library);
    const prepared = prepareWeeklyPracticeImport(JSON.stringify(REALISTIC_WEEKLY_PRACTICE_EXAMPLE), library, ids("curriculum", "monday", "e1", "e2", "tuesday", "e3", "e4", "e5", "thursday", "e6", "e7", "friday", "e8", "e9"));
    expect(prepared.ok).toBe(true); expect(library).toEqual(before);
    if (!prepared.ok) return;
    expect(prepared.candidate.preview.days.find((day) => day.kind === "rest")?.day).toBe("wednesday");
    const applied = applyWeeklyPracticeImport(library, prepared.candidate, {});
    expect(applied.ok).toBe(true); if (!applied.ok) return;
    expect(applied.library.presets).toHaveLength(4); expect(applied.library.curricula[0]?.days).toHaveLength(5);
    expect(applied.library.lastUsedPresetId).toBeNull(); expect(library).toEqual(before);
  });

  it("proposes deterministic normalized collision names, including simultaneous collisions", () => {
    const first = prepareWeeklyPracticeImport(JSON.stringify(MINIMAL_WEEKLY_PRACTICE_EXAMPLE), empty, ids("c0", "p0", "e0"));
    expect(first.ok).toBe(true); if (!first.ok) return;
    const preset = first.candidate.translated.presets[0]!;
    const library: PracticeSessionLibrary = { ...empty, presets: [{ ...preset, id: "existing-1", name: `  ${preset.name.toUpperCase()}  ` }, { ...preset, id: "existing-2", name: `${preset.name} — Imported` }] };
    const prepared = prepareWeeklyPracticeImport(JSON.stringify(MINIMAL_WEEKLY_PRACTICE_EXAMPLE), library, ids("c1", "p1", "e1"));
    expect(prepared.ok && prepared.candidate.names[0]?.proposedName).toBe(`${preset.name} — Imported (2)`);
    expect(practiceSessionPresetNameKey("  Ａ  ")).toBe("a");
  });

  it("validates edited names without regenerating IDs and rechecks current-library conflicts", () => {
    const factory = ids("c", "p", "e"); const prepared = prepareWeeklyPracticeImport(JSON.stringify(MINIMAL_WEEKLY_PRACTICE_EXAMPLE), empty, factory);
    expect(prepared.ok).toBe(true); if (!prepared.ok) return;
    const presetId = prepared.candidate.names[0]!.presetId;
    expect(validateWeeklyPracticeImportNames(empty, prepared.candidate, { [presetId]: " " })[0]?.code).toBe("empty");
    expect(factory).toHaveBeenCalledTimes(3);
    const occupied: PracticeSessionLibrary = { ...empty, presets: [{ ...prepared.candidate.translated.presets[0]!, id: "other", name: "Edited" }] };
    const applied = applyWeeklyPracticeImport(occupied, prepared.candidate, { [presetId]: "edited" });
    expect(applied.ok).toBe(false); expect(factory).toHaveBeenCalledTimes(3);
  });

  it("rejects malformed input and bounded ID exhaustion without changing the library", () => {
    const malformed = prepareWeeklyPracticeImport("not json", empty, ids());
    expect(!malformed.ok && malformed.reason).toBe("validation");
    const colliding: PracticeSessionLibrary = { ...empty, curricula: [{ id: "same", title: "Existing", instructions: null, days: [] }] };
    const exhausted = prepareWeeklyPracticeImport(JSON.stringify(MINIMAL_WEEKLY_PRACTICE_EXAMPLE), colliding, () => "same");
    expect(exhausted).toEqual(expect.objectContaining({ ok: false, reason: "id-generation" }));
  });
});
