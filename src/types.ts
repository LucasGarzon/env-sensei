import * as vscode from 'vscode';
import * as ts from 'typescript';

export type DetectionCategory = 'secret' | 'config';

export type DetectionSource = 'key-based' | 'header-based' | 'pattern-based' | 'config-based';

export interface Detection {
  range: vscode.Range;
  message: string;
  category: DetectionCategory;
  source: DetectionSource;
  proposedEnvVarName: string;
  /** Original symbol/property name associated with detection, if available */
  identifierHint?: string;
  /** Raw value kept in memory ONLY for replacement — never displayed */
  _rawValue: string;
  valueLength: number;
}

export interface EnvSenseiConfig {
  envExampleFileName: string;
  severitySecrets: vscode.DiagnosticSeverity;
  severityConfig: vscode.DiagnosticSeverity;
  ignoredGlobs: string[];
  ignoredWords: string[];
  envVarPrefix: string;
  insertFallback: boolean;
  schemaIntegration: {
    enabled: boolean;
    schemaPath: string;
  };
}

export interface EnvExampleEntry {
  key: string;
  value: string;
  lineNumber: number;
}

export interface InventoryIssue {
  type: 'missing-in-env-example' | 'unused-in-code';
  envVarName: string;
  location: vscode.Location;
}

export interface DetectorHeuristic {
  detect(sourceFile: ts.SourceFile, node: ts.Node): Detection[];
}
