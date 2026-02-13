import * as ts from 'typescript';
import * as vscode from 'vscode';

export function parseSource(text: string, fileName: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') || fileName.endsWith('.jsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS
  );
}

export function isStringLiteral(node: ts.Node): node is ts.StringLiteral {
  return node.kind === ts.SyntaxKind.StringLiteral;
}

export function isNoSubstitutionTemplateLiteral(
  node: ts.Node
): node is ts.NoSubstitutionTemplateLiteral {
  return node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral;
}

/**
 * Walk up from a string literal to find the variable or property name it's assigned to.
 * Handles: const foo = "...", { foo: "..." }, foo: "..." in object literal,
 * and fallback expressions like foo ?? "...", bar || "...".
 */
export function getAssignmentIdentifier(
  node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
  _sourceFile: ts.SourceFile
): string | undefined {
  let current: ts.Node = node;
  
  while (current.parent) {
    const parent = current.parent;
    
    // const foo = "..."
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }

    // { foo: "..." }
    if (ts.isPropertyAssignment(parent)) {
      if (ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
      if (ts.isStringLiteral(parent.name)) {
        return parent.name.text;
      }
    }

    // foo = "..." or foo = bar ?? "..."
    if (
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      if (ts.isIdentifier(parent.left)) {
        return parent.left.text;
      }
      // Handle property assignments like this.apiKey = ...
      if (ts.isPropertyAccessExpression(parent.left) && ts.isIdentifier(parent.left.name)) {
        return parent.left.name.text;
      }
      return undefined;
    }
    
    // Walk up through fallback operators: ??, ||, &&
    if (
      ts.isBinaryExpression(parent) &&
      (parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || // ??
       parent.operatorToken.kind === ts.SyntaxKind.BarBarToken || // ||
       parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) // &&
    ) {
      current = parent;
      continue;
    }

    // Parameter default: function(foo = "...")
    if (ts.isParameter(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    
    // If we hit something else, stop traversing
    break;
  }

  return undefined;
}

/**
 * Get the property name when a string literal is used as an object property value.
 */
export function getPropertyName(
  node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
  _sourceFile: ts.SourceFile
): string | undefined {
  const parent = node.parent;
  if (!parent) return undefined;

  if (ts.isPropertyAssignment(parent)) {
    if (ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    if (ts.isStringLiteral(parent.name)) {
      return parent.name.text;
    }
  }

  return undefined;
}

export function nodeRange(node: ts.Node, sourceFile: ts.SourceFile): vscode.Range {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return new vscode.Range(
    new vscode.Position(start.line, start.character),
    new vscode.Position(end.line, end.character)
  );
}
