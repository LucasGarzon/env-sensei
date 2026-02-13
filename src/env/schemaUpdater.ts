import * as fs from 'fs';
import { DetectionCategory } from '../types';

/**
 * Add an env var to a Zod schema file.
 * Inserts a new field before the closing `})` or `});` of the schema object.
 */
export async function addToEnvSchema(
  schemaPath: string,
  varName: string,
  category: DetectionCategory
): Promise<boolean> {
  if (!fs.existsSync(schemaPath)) {
    // Create a minimal schema file
    const content = buildMinimalSchema(varName, category);
    fs.writeFileSync(schemaPath, content, 'utf-8');
    return true;
  }

  const content = fs.readFileSync(schemaPath, 'utf-8');

  // Check if var already exists in the schema
  if (content.includes(varName)) {
    return false;
  }

  const zodType = category === 'secret' ? 'z.string().min(1)' : 'z.string().optional()';
  const newField = `  ${varName}: ${zodType},`;

  // Find the last `})` pattern to insert before it
  const closingPattern = /\}\s*\)\s*;?\s*$/m;
  const match = closingPattern.exec(content);

  if (!match || match.index === undefined) {
    // Fallback: append as comment if we can't find the pattern
    const fallback = `\n// TODO: Add ${varName} to your schema\n// ${varName}: ${zodType}\n`;
    fs.writeFileSync(schemaPath, content + fallback, 'utf-8');
    return true;
  }

  const before = content.substring(0, match.index);
  const after = content.substring(match.index);
  const updated = before + newField + '\n' + after;

  fs.writeFileSync(schemaPath, updated, 'utf-8');
  return true;
}

function buildMinimalSchema(varName: string, category: DetectionCategory): string {
  const zodType = category === 'secret' ? 'z.string().min(1)' : 'z.string().optional()';
  return `import { z } from 'zod';

export const envSchema = z.object({
  ${varName}: ${zodType},
});

export type Env = z.infer<typeof envSchema>;
`;
}
