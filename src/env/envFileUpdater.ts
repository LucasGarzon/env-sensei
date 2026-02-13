import * as fs from 'fs';
import { EnvExampleEntry, DetectionCategory } from '../types';

export function readEnvExample(filePath: string): EnvExampleEntry[] {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const entries: EnvExampleEntry[] = [];

  content.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;

    entries.push({
      key: trimmed.substring(0, eqIndex).trim(),
      value: trimmed.substring(eqIndex + 1).trim(),
      lineNumber: index,
    });
  });

  return entries;
}

export async function addToEnvExample(
  envExamplePath: string,
  varName: string,
  category: DetectionCategory
): Promise<void> {
  const existing = readEnvExample(envExamplePath);
  if (existing.some(e => e.key === varName)) return;

  const placeholder = category === 'secret' ? '__REQUIRED__' : '__SET_ME__';
  const line = `${varName}=${placeholder}\n`;

  if (fs.existsSync(envExamplePath)) {
    const content = fs.readFileSync(envExamplePath, 'utf-8');
    const separator = content.endsWith('\n') ? '' : '\n';
    fs.writeFileSync(envExamplePath, content + separator + line, 'utf-8');
  } else {
    fs.writeFileSync(envExamplePath, line, 'utf-8');
  }
}
