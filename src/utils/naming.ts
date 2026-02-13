/**
 * Convert an identifier to UPPER_SNAKE_CASE for env var naming.
 * Examples: jwtSecret → JWT_SECRET, apiKey → API_KEY, baseUrl → BASE_URL
 */
export function toEnvVarName(identifier: string, prefix?: string): string {
  // Insert underscore before uppercase letters that follow lowercase letters or digits
  // e.g. jwtSecret → jwt_Secret, apiKey → api_Key
  let result = identifier.replace(/([a-z0-9])([A-Z])/g, '$1_$2');

  // Insert underscore between consecutive uppercase and lowercase
  // e.g. HTMLParser → HTML_Parser
  result = result.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2');

  result = result.toUpperCase();

  // Collapse multiple underscores
  result = result.replace(/_+/g, '_');

  // Trim leading/trailing underscores
  result = result.replace(/^_+|_+$/g, '');

  if (prefix) {
    const normalizedPrefix = prefix.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const prefixWithUnderscore = normalizedPrefix.endsWith('_')
      ? normalizedPrefix
      : normalizedPrefix + '_';
    if (!result.startsWith(prefixWithUnderscore)) {
      result = prefixWithUnderscore + result;
    }
  }

  return result;
}
