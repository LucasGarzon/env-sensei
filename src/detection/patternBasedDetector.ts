import * as ts from 'typescript';
import { Detection, DetectorHeuristic } from '../types';
import { VALUE_PATTERNS } from '../constants';
import { isStringLiteral, isNoSubstitutionTemplateLiteral, getAssignmentIdentifier, nodeRange } from '../utils/astHelpers';
import { toEnvVarName } from '../utils/naming';
import { redactValue } from '../utils/redact';

export class PatternBasedDetector implements DetectorHeuristic {
  detect(sourceFile: ts.SourceFile, node: ts.Node): Detection[] {
    if (!isStringLiteral(node) && !isNoSubstitutionTemplateLiteral(node)) {
      return [];
    }

    const value = node.text;
    if (!value || value.length < 5) return [];

    const detections: Detection[] = [];

    for (const pattern of VALUE_PATTERNS) {
      if (pattern.regex.test(value)) {
        const identifier = getAssignmentIdentifier(node, sourceFile);
        const envVarName = identifier
          ? toEnvVarName(identifier)
          : patternToEnvVarName(pattern.name);

        detections.push({
          range: nodeRange(node, sourceFile),
          message: `Possible ${pattern.name} detected ${redactValue(value)}. Consider using an environment variable.`,
          category: pattern.category,
          source: 'pattern-based',
          proposedEnvVarName: envVarName,
          identifierHint: identifier ?? pattern.name,
          _rawValue: value,
          valueLength: value.length,
        });
        break; // One match per string literal is enough
      }
    }

    return detections;
  }
}

function patternToEnvVarName(patternName: string): string {
  return patternName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
