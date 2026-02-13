import * as ts from 'typescript';
import { Detection, DetectorHeuristic } from '../types';
import { SECRET_KEY_PATTERNS } from '../constants';
import { isStringLiteral, isNoSubstitutionTemplateLiteral, getAssignmentIdentifier, nodeRange } from '../utils/astHelpers';
import { toEnvVarName } from '../utils/naming';
import { redactValue } from '../utils/redact';

export class KeyBasedDetector implements DetectorHeuristic {
  detect(sourceFile: ts.SourceFile, node: ts.Node): Detection[] {
    if (!isStringLiteral(node) && !isNoSubstitutionTemplateLiteral(node)) {
      return [];
    }

    const value = node.text;
    if (!value || value.length < 2) return [];

    const parent = node.parent;
    if (!parent) return [];

    // For PropertyAssignment (object literals like { foo: "bar" }),
    // only flag the value (initializer), not the property name (key)
    if (ts.isPropertyAssignment(parent)) {
      // Skip if this node is the property name (key)
      if (node === parent.name) {
        return [];
      }
      // Also skip if the value is not a string literal (e.g., it's a variable)
      if (!isStringLiteral(parent.initializer) && !isNoSubstitutionTemplateLiteral(parent.initializer)) {
        return [];
      }
    }

    const identifier = getAssignmentIdentifier(node, sourceFile);
    if (!identifier) return [];

    const identifierLower = identifier.toLowerCase();
    const matchedPattern = SECRET_KEY_PATTERNS.find(pattern =>
      identifierLower.includes(pattern)
    );

    if (!matchedPattern) return [];

    return [{
      range: nodeRange(node, sourceFile),
      message: `Possible hardcoded secret in "${identifier}" ${redactValue(value)}. Consider using an environment variable.`,
      category: 'secret',
      source: 'key-based',
      proposedEnvVarName: toEnvVarName(identifier),
      identifierHint: identifier,
      _rawValue: value,
      valueLength: value.length,
    }];
  }
}
