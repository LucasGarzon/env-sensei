import * as ts from 'typescript';
import { Detection, DetectorHeuristic } from '../types';
import { SENSITIVE_HEADERS } from '../constants';
import { isStringLiteral, isNoSubstitutionTemplateLiteral, nodeRange } from '../utils/astHelpers';
import { toEnvVarName } from '../utils/naming';
import { redactValue } from '../utils/redact';

export class HeaderBasedDetector implements DetectorHeuristic {
  detect(sourceFile: ts.SourceFile, node: ts.Node): Detection[] {
    if (!isStringLiteral(node) && !isNoSubstitutionTemplateLiteral(node)) {
      return [];
    }

    const value = node.text;
    if (!value || value.length < 2) return [];

    const parent = node.parent;
    if (!parent || !ts.isPropertyAssignment(parent)) {
      return [];
    }

    // Only check the value (initializer), not the property name (key)
    // The initializer is the right-hand side of the assignment
    if (node !== parent.initializer) {
      return [];
    }

    // Double-check: the initializer should be a string literal
    // If it's a variable (identifier), we shouldn't flag it
    if (!isStringLiteral(parent.initializer) && !isNoSubstitutionTemplateLiteral(parent.initializer)) {
      return [];
    }

    // Get the property name (key)
    let propertyName: string | undefined;
    if (ts.isIdentifier(parent.name)) {
      propertyName = parent.name.text;
    } else if (ts.isStringLiteral(parent.name)) {
      propertyName = parent.name.text;
    }

    if (!propertyName) return [];

    const propertyLower = propertyName.toLowerCase();
    const isHeader = SENSITIVE_HEADERS.includes(propertyLower);

    if (!isHeader) return [];

    return [{
      range: nodeRange(node, sourceFile),
      message: `Hardcoded value in sensitive header "${propertyName}" ${redactValue(value)}. Consider using an environment variable.`,
      category: 'secret',
      source: 'header-based',
      proposedEnvVarName: toEnvVarName(propertyName),
      identifierHint: propertyName,
      _rawValue: value,
      valueLength: value.length,
    }];
  }
}
