import { describe, expect, it } from "vitest";
import { MUSICAL_INTERVALS } from "@/lib/music/intervals";
import { SCALE_REPERTOIRE_CATALOG } from "@/features/sequences/scale-repertoire";
import { WEEKLY_PRACTICE_CAPABILITIES, WEEKLY_PRACTICE_EXERCISE_TYPES, WEEKLY_PRACTICE_LIMITS } from "./weekly-practice-contract";
import { MINIMAL_WEEKLY_PRACTICE_EXAMPLE, REALISTIC_WEEKLY_PRACTICE_EXAMPLE } from "./weekly-practice-examples";
import { WEEKLY_PRACTICE_EXERCISE_SCHEMAS, WEEKLY_PRACTICE_JSON_SCHEMA_V1 } from "./weekly-practice-schema";
import { createWeeklyPracticeLlmSpecification } from "./weekly-practice-specification";
import { validateWeeklyPracticeCurriculum } from "./weekly-practice-validation";

describe("Weekly Practice published contract artifacts", () => {
  it("covers every discriminator and omits a fabricated schema id", () => {
    expect(Object.keys(WEEKLY_PRACTICE_EXERCISE_SCHEMAS)).toEqual(WEEKLY_PRACTICE_EXERCISE_TYPES);
    expect(WEEKLY_PRACTICE_JSON_SCHEMA_V1).toMatchObject({ $schema: "https://json-schema.org/draft/2020-12/schema", additionalProperties: false });
    expect(WEEKLY_PRACTICE_JSON_SCHEMA_V1).not.toHaveProperty("$id");
  });

  it("derives interval and selectable repertoire values from feature sources", () => {
    expect(WEEKLY_PRACTICE_CAPABILITIES.intervals).toBe(MUSICAL_INTERVALS);
    expect(WEEKLY_PRACTICE_CAPABILITIES.repertoireScales).toEqual(SCALE_REPERTOIRE_CATALOG.filter(({ disabledReason }) => !disabledReason).map(({ id }) => id));
    expect(WEEKLY_PRACTICE_CAPABILITIES.repertoireScales).not.toContain("g-sharp-harmonic-minor");
    expect(WEEKLY_PRACTICE_CAPABILITIES.repertoireScales).not.toContain("g-sharp-melodic-minor");
  });

  it("publishes contract limits in the JSON Schema structure", () => {
    expect(WEEKLY_PRACTICE_JSON_SCHEMA_V1.properties.title).toMatchObject({ maxLength: WEEKLY_PRACTICE_LIMITS.titleCharacters });
    expect(WEEKLY_PRACTICE_JSON_SCHEMA_V1.properties.days).toMatchObject({ maxItems: 7 });
  });

  it("keeps minimal and realistic examples behaviorally valid", () => {
    expect(validateWeeklyPracticeCurriculum(MINIMAL_WEEKLY_PRACTICE_EXAMPLE, (() => { let id = 0; return () => `${id++}`; })())).toMatchObject({ ok: true });
    expect(validateWeeklyPracticeCurriculum(REALISTIC_WEEKLY_PRACTICE_EXAMPLE, (() => { let id = 0; return () => `${id++}`; })())).toMatchObject({ ok: true });
  });

  it("creates a self-contained Copy-for-AI specification with pedagogy and safety instructions", () => {
    const specification = createWeeklyPracticeLlmSpecification();
    for (const type of WEEKLY_PRACTICE_EXERCISE_TYPES) expect(specification).toContain(`- ${type}:`);
    expect(specification).toContain("Return exactly one raw JSON object");
    expect(specification).toContain("Do not use Markdown fences");
    expect(specification).toContain("Add no surrounding commentary");
    expect(specification).toContain("Do not invent hand, fingering");
    expect(specification).toContain("Include no runtime state");
    expect(specification).toContain("Read isolated staff notes");
    expect(specification).toContain(JSON.stringify(MINIMAL_WEEKLY_PRACTICE_EXAMPLE, null, 2));
  });
});
