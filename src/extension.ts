import * as vscode from 'vscode';
import * as path from 'path';
import { DetectionCategory } from './types';
import { loadConfig, watchConfig } from './config/configLoader';
import { DiagnosticsManager } from './diagnostics/diagnosticsProvider';
import { EnvSenseiCodeActionProvider } from './actions/codeActionProvider';
import { addToEnvExample, readEnvExample } from './env/envFileUpdater';
import { scanProcessEnvUsage, compareWithEnvExample } from './env/envInventoryScanner';
import { addToEnvSchema } from './env/schemaUpdater';
import { findNearestEnvExample } from './utils/fileUtils';
import { DIAGNOSTIC_SOURCE } from './constants';

const SUPPORTED_LANGUAGES = new Set([
  'typescript', 'typescriptreact', 'javascript', 'javascriptreact',
]);

function isSupported(document: vscode.TextDocument): boolean {
  return SUPPORTED_LANGUAGES.has(document.languageId) && document.uri.scheme === 'file';
}

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  let config = loadConfig(workspaceRoot);

  const diagnosticsManager = new DiagnosticsManager(config);
  const inventoryCollection = vscode.languages.createDiagnosticCollection('env-sensei-inventory');
  const codeActionProvider = new EnvSenseiCodeActionProvider(diagnosticsManager, config);

  const selector: vscode.DocumentSelector = [
    { language: 'typescript', scheme: 'file' },
    { language: 'typescriptreact', scheme: 'file' },
    { language: 'javascript', scheme: 'file' },
    { language: 'javascriptreact', scheme: 'file' },
  ];

  context.subscriptions.push(
    diagnosticsManager,
    inventoryCollection,
    vscode.languages.registerCodeActionsProvider(selector, codeActionProvider, {
      providedCodeActionKinds: EnvSenseiCodeActionProvider.providedCodeActionKinds,
    }),
  );

  // Analyze already-open documents
  vscode.workspace.textDocuments.forEach(doc => {
    if (isSupported(doc)) diagnosticsManager.scheduleAnalysis(doc);
  });

  // Subscribe to document events
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (isSupported(doc)) diagnosticsManager.scheduleAnalysis(doc);
    }),
    vscode.workspace.onDidChangeTextDocument(event => {
      if (isSupported(event.document)) diagnosticsManager.scheduleAnalysis(event.document);
    }),
    vscode.workspace.onDidCloseTextDocument(doc => {
      diagnosticsManager.clearDocument(doc.uri);
    }),
  );

  // Watch config file for hot-reload
  context.subscriptions.push(
    watchConfig(workspaceRoot, newConfig => {
      config = newConfig;
      diagnosticsManager.updateConfig(newConfig);
      codeActionProvider.updateConfig(newConfig);
      vscode.workspace.textDocuments.forEach(doc => {
        if (isSupported(doc)) diagnosticsManager.scheduleAnalysis(doc);
      });
    }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration('envSensei')) {
        return;
      }
      const newConfig = loadConfig(workspaceRoot);
      config = newConfig;
      diagnosticsManager.updateConfig(newConfig);
      codeActionProvider.updateConfig(newConfig);
      vscode.workspace.textDocuments.forEach(doc => {
        if (isSupported(doc)) diagnosticsManager.scheduleAnalysis(doc);
      });
    }),
  );

  // Command: Add to .env.example (called by code actions)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'envSensei.addIgnoredWord',
      async (word: string, target: 'workspace' | 'user' = 'workspace') => {
        const cleaned = typeof word === 'string' ? word.trim() : '';
        if (!cleaned) {
          vscode.window.showWarningMessage('Env Sensei: Invalid ignored word.');
          return;
        }

        const vscodeConfig = vscode.workspace.getConfiguration('envSensei');
        const current = vscodeConfig.get<string[]>('ignoredWords') || [];
        const alreadyExists = current.some(existing => existing.toLowerCase() === cleaned.toLowerCase());
        if (alreadyExists) {
          vscode.window.showInformationMessage(
            `Env Sensei: "${cleaned}" is already in envSensei.ignoredWords.`
          );
          return;
        }

        if (target === 'workspace' && !vscode.workspace.workspaceFolders?.length) {
          vscode.window.showWarningMessage(
            'Env Sensei: Open a workspace folder to save workspace settings.'
          );
          return;
        }

        const next = [...current, cleaned];
        const configTarget = target === 'user'
          ? vscode.ConfigurationTarget.Global
          : vscode.ConfigurationTarget.Workspace;

        await vscodeConfig.update('ignoredWords', next, configTarget);
        vscode.window.showInformationMessage(
          `Env Sensei: Added "${cleaned}" to ${target} ignored words.`
        );
      }
    ),
    // Command: Add to .env.example (called by code actions)
    vscode.commands.registerCommand(
      'envSensei.addToEnvExample',
      async (filePath: string, varName: string, category: DetectionCategory, envFileName: string) => {
        const envExamplePath = findNearestEnvExample(filePath, envFileName);
        if (envExamplePath) {
          await addToEnvExample(envExamplePath, varName, category);
          vscode.window.showInformationMessage(
            `Env Sensei: Added ${varName} to ${path.basename(envExamplePath)}`
          );
        } else if (workspaceRoot) {
          // Create .env.example at workspace root
          const newPath = path.join(workspaceRoot, envFileName);
          await addToEnvExample(newPath, varName, category);
          vscode.window.showInformationMessage(
            `Env Sensei: Created ${envFileName} and added ${varName}`
          );
        } else {
          vscode.window.showWarningMessage(
            `Env Sensei: Could not find ${envFileName}. Open a workspace folder first.`
          );
        }
      }
    ),
  );

  // Command: Add to Zod env schema (called by code actions)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'envSensei.addToEnvSchema',
      async (varName: string, category: DetectionCategory, schemaPath: string) => {
        if (!workspaceRoot) {
          vscode.window.showWarningMessage('Env Sensei: Open a workspace folder first.');
          return;
        }
        const fullPath = path.join(workspaceRoot, schemaPath);
        const added = await addToEnvSchema(fullPath, varName, category);
        if (added) {
          vscode.window.showInformationMessage(
            `Env Sensei: Added ${varName} to ${schemaPath}`
          );
        } else {
          vscode.window.showInformationMessage(
            `Env Sensei: ${varName} already exists in ${schemaPath}`
          );
        }
      }
    ),
  );

  // Command: Scan inventory — compare process.env usage with .env.example
  context.subscriptions.push(
    vscode.commands.registerCommand('envSensei.scanInventory', async () => {
      if (!workspaceRoot) {
        vscode.window.showWarningMessage('Env Sensei: Open a workspace folder to scan inventory.');
        return;
      }

      inventoryCollection.clear();

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Env Sensei: Scanning inventory...' },
        async () => {
          const usageMap = await scanProcessEnvUsage(workspaceRoot, config.ignoredGlobs);
          const envExamplePath = path.join(workspaceRoot, config.envExampleFileName);
          const envEntries = readEnvExample(envExamplePath);
          const envExampleUri = vscode.Uri.file(envExamplePath);

          const issues = compareWithEnvExample(usageMap, envEntries, envExampleUri);

          // Group diagnostics by URI
          const diagnosticsByUri = new Map<string, vscode.Diagnostic[]>();

          for (const issue of issues) {
            const uri = issue.location.uri.toString();
            const existing = diagnosticsByUri.get(uri) || [];

            const severity = issue.type === 'missing-in-env-example'
              ? vscode.DiagnosticSeverity.Warning
              : vscode.DiagnosticSeverity.Information;

            const message = issue.type === 'missing-in-env-example'
              ? `process.env.${issue.envVarName} is used but missing in ${config.envExampleFileName}`
              : `${issue.envVarName} is defined in ${config.envExampleFileName} but not used in code`;

            const diagnostic = new vscode.Diagnostic(issue.location.range, message, severity);
            diagnostic.source = DIAGNOSTIC_SOURCE;
            existing.push(diagnostic);
            diagnosticsByUri.set(uri, existing);
          }

          for (const [uriStr, diagnostics] of diagnosticsByUri) {
            inventoryCollection.set(vscode.Uri.parse(uriStr), diagnostics);
          }

          const missing = issues.filter(i => i.type === 'missing-in-env-example').length;
          const unused = issues.filter(i => i.type === 'unused-in-code').length;
          vscode.window.showInformationMessage(
            `Env Sensei: Found ${missing} missing in ${config.envExampleFileName}, ${unused} unused vars.`
          );
        }
      );
    }),
  );
}

export function deactivate(): void {}
