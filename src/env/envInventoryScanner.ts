import * as vscode from 'vscode';
import * as ts from 'typescript';
import { EnvExampleEntry, InventoryIssue } from '../types';
import { DEFAULT_IGNORED_GLOBS } from '../constants';
import { parseSource } from '../utils/astHelpers';

/**
 * Scan workspace files for process.env.X usage.
 * Returns a map of env var name → locations where it's used.
 */
export async function scanProcessEnvUsage(
  workspaceRoot: string,
  ignoredGlobs: string[]
): Promise<Map<string, vscode.Location[]>> {
  const usageMap = new Map<string, vscode.Location[]>();

  const allIgnored = [...DEFAULT_IGNORED_GLOBS, ...ignoredGlobs];
  const include = '**/*.{ts,tsx,js,jsx}';
  const exclude = `{${allIgnored.join(',')}}`;

  const files = await vscode.workspace.findFiles(include, exclude);

  for (const fileUri of files) {
    const document = await vscode.workspace.openTextDocument(fileUri);
    const sourceFile = parseSource(document.getText(), document.fileName);

    const visit = (node: ts.Node) => {
      // Match process.env.X → PropertyAccessExpression
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'process' &&
        node.expression.name.text === 'env'
      ) {
        const envVarName = node.name.text;
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const range = new vscode.Range(
          new vscode.Position(start.line, start.character),
          new vscode.Position(end.line, end.character)
        );
        const location = new vscode.Location(fileUri, range);

        const existing = usageMap.get(envVarName) || [];
        existing.push(location);
        usageMap.set(envVarName, existing);
      }

      // Match process.env["X"] or process.env['X'] → ElementAccessExpression
      if (
        ts.isElementAccessExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'process' &&
        node.expression.name.text === 'env' &&
        ts.isStringLiteral(node.argumentExpression)
      ) {
        const envVarName = node.argumentExpression.text;
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const range = new vscode.Range(
          new vscode.Position(start.line, start.character),
          new vscode.Position(end.line, end.character)
        );
        const location = new vscode.Location(fileUri, range);

        const existing = usageMap.get(envVarName) || [];
        existing.push(location);
        usageMap.set(envVarName, existing);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return usageMap;
}

/**
 * Compare process.env usage with .env.example entries.
 * Returns issues: missing in .env.example or unused in code.
 */
export function compareWithEnvExample(
  usageMap: Map<string, vscode.Location[]>,
  envEntries: EnvExampleEntry[],
  envExampleUri: vscode.Uri
): InventoryIssue[] {
  const issues: InventoryIssue[] = [];
  const envKeys = new Set(envEntries.map(e => e.key));

  // process.env.X used in code but missing in .env.example
  for (const [varName, locations] of usageMap) {
    if (!envKeys.has(varName)) {
      for (const location of locations) {
        issues.push({
          type: 'missing-in-env-example',
          envVarName: varName,
          location,
        });
      }
    }
  }

  // .env.example has keys not used in code
  for (const entry of envEntries) {
    if (!usageMap.has(entry.key)) {
      const range = new vscode.Range(
        new vscode.Position(entry.lineNumber, 0),
        new vscode.Position(entry.lineNumber, entry.key.length)
      );
      issues.push({
        type: 'unused-in-code',
        envVarName: entry.key,
        location: new vscode.Location(envExampleUri, range),
      });
    }
  }

  return issues;
}
