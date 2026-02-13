import * as path from 'path';
import * as fs from 'fs';

/**
 * Walk up from a file path looking for the nearest env example file.
 * Stops at filesystem root.
 */
export function findNearestEnvExample(
  fromFilePath: string,
  fileName: string
): string | undefined {
  let dir = path.dirname(fromFilePath);
  const root = path.parse(dir).root;

  let searching = true;
  while (searching) {
    const candidate = path.join(dir, fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parentDir = path.dirname(dir);
    if (parentDir === dir || dir === root) {
      searching = false;
    } else {
      dir = parentDir;
    }
  }

  return undefined;
}
