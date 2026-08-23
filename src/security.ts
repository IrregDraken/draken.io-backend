const sensitiveKey =
  /(api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret|credential|authorization|private[-_]?key|session)/iu;

export function sanitizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeJson(item));
  if (typeof value !== 'object' || value === null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (sensitiveKey.test(key)) continue;
    result[key] = sanitizeJson(nested);
  }
  return result;
}

export function sanitizeRecord(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeJson(value);
  return typeof sanitized === 'object' && sanitized !== null && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
}
