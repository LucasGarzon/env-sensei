import * as vscode from 'vscode';
import { Detection, EnvSenseiConfig } from '../types';
import { DiagnosticsManager } from '../diagnostics/diagnosticsProvider';
import { DIAGNOSTIC_SOURCE } from '../constants';

export class EnvSenseiCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor(
    private diagnosticsManager: DiagnosticsManager,
    private config: EnvSenseiConfig
  ) {}

  updateConfig(config: EnvSenseiConfig): void {
    this.config = config;
  }

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    const detections = this.diagnosticsManager.getDetections(document.uri);

    const relevantDiagnostics = context.diagnostics.filter(
      d => d.source === DIAGNOSTIC_SOURCE
    );

    for (const diagnostic of relevantDiagnostics) {
      const detection = detections.find(d =>
        d.range.isEqual(diagnostic.range)
      );

      if (!detection) continue;

      // Action 1: Extract to env var + add to .env.example
      actions.push(this.createExtractAction(document, diagnostic, detection));

      // Action 2: Add to .env.example only (no code replacement)
      actions.push(this.createAddToEnvExampleAction(document, diagnostic, detection));

      // Action 3: Add to Zod schema (if enabled)
      if (this.config.schemaIntegration.enabled) {
        actions.push(this.createAddToSchemaAction(document, diagnostic, detection));
      }
    }

    return actions;
  }

  private createExtractAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    detection: Detection
  ): vscode.CodeAction {
    const replacement = this.config.insertFallback
      ? `process.env.${detection.proposedEnvVarName} ?? ""`
      : `process.env.${detection.proposedEnvVarName}`;

    const action = new vscode.CodeAction(
      `Extract to env var: ${detection.proposedEnvVarName}`,
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, detection.range, replacement);
    action.edit = edit;

    action.command = {
      command: 'envSensei.addToEnvExample',
      title: 'Add to .env.example',
      arguments: [
        document.uri.fsPath,
        detection.proposedEnvVarName,
        detection.category,
        this.config.envExampleFileName,
      ],
    };

    return action;
  }

  private createAddToEnvExampleAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    detection: Detection
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Add to ${this.config.envExampleFileName}: ${detection.proposedEnvVarName}`,
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = [diagnostic];

    action.command = {
      command: 'envSensei.addToEnvExample',
      title: 'Add to .env.example',
      arguments: [
        document.uri.fsPath,
        detection.proposedEnvVarName,
        detection.category,
        this.config.envExampleFileName,
      ],
    };

    return action;
  }

  private createAddToSchemaAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    detection: Detection
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Add to env schema (Zod): ${detection.proposedEnvVarName}`,
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = [diagnostic];

    action.command = {
      command: 'envSensei.addToEnvSchema',
      title: 'Add to env schema',
      arguments: [
        detection.proposedEnvVarName,
        detection.category,
        this.config.schemaIntegration.schemaPath,
      ],
    };

    return action;
  }
}
