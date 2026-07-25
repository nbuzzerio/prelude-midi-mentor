export function toggleRequiredSetValue<T>(
  currentValues: ReadonlySet<T>,
  value: T,
): ReadonlySet<T> {
  const nextValues = new Set(currentValues);

  if (!nextValues.has(value)) {
    nextValues.add(value);
    return nextValues;
  }

  if (nextValues.size === 1) {
    return currentValues;
  }

  nextValues.delete(value);
  return nextValues;
}
