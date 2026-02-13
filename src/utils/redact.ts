/**
 * Redact a value for safe display. NEVER returns the actual value.
 */
export function redactValue(value: string): string {
  return `[REDACTED: ${value.length} chars]`;
}
