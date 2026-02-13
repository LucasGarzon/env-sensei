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

      const ignoreWordActions = this.createIgnoreWordActions(diagnostic, detection);
      actions.push(...ignoreWordActions);
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

  private createIgnoreWordActions(
    diagnostic: vscode.Diagnostic,
    detection: Detection
  ): vscode.CodeAction[] {
    const wordToIgnore = this.pickWordToIgnore(detection);
    if (!wordToIgnore) {
      return [];
    }

    const workspaceAction = new vscode.CodeAction(
      `Ignore "${wordToIgnore}" in workspace settings`,
      vscode.CodeActionKind.QuickFix
    );
    workspaceAction.diagnostics = [diagnostic];
    workspaceAction.command = {
      command: 'envSensei.addIgnoredWord',
      title: 'Add ignored word (workspace)',
      arguments: [wordToIgnore, 'workspace'],
    };

    const userAction = new vscode.CodeAction(
      `Ignore "${wordToIgnore}" in user settings`,
      vscode.CodeActionKind.QuickFix
    );
    userAction.diagnostics = [diagnostic];
    userAction.command = {
      command: 'envSensei.addIgnoredWord',
      title: 'Add ignored word (user)',
      arguments: [wordToIgnore, 'user'],
    };

    return [workspaceAction, userAction];
  }

  private pickWordToIgnore(detection: Detection): string | undefined {
    const fromHost = this.extractHostFromUriLikeValue(detection._rawValue);
    if (fromHost) {
      return fromHost;
    }

    const fromIdentifier = this.extractToken(detection.identifierHint);
    if (fromIdentifier) {
      return fromIdentifier;
    }

    return this.extractToken(detection._rawValue);
  }

  private extractHostFromUriLikeValue(value: string): string | undefined {
    const hostMatch = value.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
    if (!hostMatch) {
      return undefined;
    }

    const hostWithPort = hostMatch[1].replace(/^\[|\]$/g, '');
    const host = hostWithPort.split(':')[0].trim();
    if (!host) {
      return undefined;
    }

    return host.toLowerCase();
  }

  private extractToken(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const token = value
      .split(/[^a-zA-Z0-9_]+/)
      .find(part => part.length >= 3);

    return token ? token.toLowerCase() : undefined;
  }
}
