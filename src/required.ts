export function required<T>(value: T | null | undefined, label: string): T {
  if (value == null) throw new Error('Missing ' + label);
  return value;
}
