/** Structural validation only; musical eligibility remains feature-owned. */
export type ConfigParseResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; reason: "corrupt" | "unsupported" }>;
export type ConfigFieldValidator = (value: unknown) => boolean;
export const booleanField: ConfigFieldValidator = (value) => typeof value === "boolean";
export const enumField = (values: readonly (string | number)[]): ConfigFieldValidator =>
  (value) => values.some((candidate) => candidate === value);
export const selectionField = (values: readonly string[]): ConfigFieldValidator =>
  (value) => Array.isArray(value) && value.length > 0
    && value.every((item) => typeof item === "string" && values.includes(item))
    && new Set(value).size === value.length;

/** Reject extra/missing fields and duplicates rather than silently changing a prescription. */
export function parseConfig<T extends { schemaVersion: 1 }>(
  value: unknown,
  fields: Readonly<Record<keyof T, ConfigFieldValidator>>,
): ConfigParseResult<T> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, reason: "corrupt" };
  const record = value as Record<string, unknown>;
  if (typeof record.schemaVersion === "number" && Number.isInteger(record.schemaVersion)
    && record.schemaVersion > 0 && record.schemaVersion !== 1) return { ok: false, reason: "unsupported" };
  const entries = Object.entries(fields) as [string, ConfigFieldValidator][];
  if (Object.keys(record).length !== entries.length || entries.some(([key, validate]) => !Object.hasOwn(record, key) || !validate(record[key]))) {
    return { ok: false, reason: "corrupt" };
  }
  // Each field has been checked above. Copy arrays to detach the boundary from caller mutation.
  return { ok: true, value: Object.fromEntries(entries.map(([key]) => [key,
    Array.isArray(record[key]) ? [...record[key]] : record[key],
  ])) as T };
}

export function requireConfig<T>(result: ConfigParseResult<T>): T {
  if (!result.ok) throw new Error(`Invalid feature configuration: ${result.reason}`);
  return result.value;
}
