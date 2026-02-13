import * as ts from 'typescript';
import { Detection, DetectorHeuristic } from '../types';
import { CONFIG_KEY_PATTERNS } from '../constants';
import { isStringLiteral, isNoSubstitutionTemplateLiteral, getAssignmentIdentifier, nodeRange } from '../utils/astHelpers';
import { toEnvVarName } from '../utils/naming';
import { redactValue } from '../utils/redact';

export class ConfigBasedDetector implements DetectorHeuristic {
  detect(sourceFile: ts.SourceFile, node: ts.Node): Detection[] {
    if (!isStringLiteral(node) && !isNoSubstitutionTemplateLiteral(node)) {
      return [];
    }

    const value = node.text;
    if (!value || value.length < 2) return [];

    const identifier = getAssignmentIdentifier(node, sourceFile);
    if (!identifier) return [];

    const identifierLower = identifier.toLowerCase();
    const matchedPattern = CONFIG_KEY_PATTERNS.find(pattern =>
      identifierLower.includes(pattern)
    );

    if (!matchedPattern) return [];

    return [{
      range: nodeRange(node, sourceFile),
      message: `Hardcoded config value in "${identifier}" ${redactValue(value)}. Consider using an environment variable.`,
      category: 'config',
      source: 'config-based',
      proposedEnvVarName: toEnvVarName(identifier),
      identifierHint: identifier,
      _rawValue: value,
      valueLength: value.length,
    }];
  }
}
