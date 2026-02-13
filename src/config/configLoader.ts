import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EnvSenseiConfig } from '../types';
import { DEFAULT_CONFIG } from '../constants';

const CONFIG_FILE_NAME = '.envsenseirc.json';

export function loadConfig(workspaceRoot: string | undefined): EnvSenseiConfig {
  if (!workspaceRoot) return { ...DEFAULT_CONFIG };

  const configPath = path.join(workspaceRoot, CONFIG_FILE_NAME);
  if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG };

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return mergeConfig(parsed);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function mergeConfig(raw: Record<string, unknown>): EnvSenseiConfig {
  const config = { ...DEFAULT_CONFIG };

  if (typeof raw.envExampleFileName === 'string') {
    config.envExampleFileName = raw.envExampleFileName;
  }
  if (typeof raw.severitySecrets === 'string') {
    config.severitySecrets = parseSeverity(raw.severitySecrets);
  }
  if (typeof raw.severityConfig === 'string') {
    config.severityConfig = parseSeverity(raw.severityConfig);
  }
  if (Array.isArray(raw.ignoredGlobs)) {
    config.ignoredGlobs = raw.ignoredGlobs.filter(
      (g): g is string => typeof g === 'string'
    );
  }
  if (typeof raw.envVarPrefix === 'string') {
    config.envVarPrefix = raw.envVarPrefix;
  }
  if (typeof raw.insertFallback === 'boolean') {
    config.insertFallback = raw.insertFallback;
  }
  if (raw.schemaIntegration && typeof raw.schemaIntegration === 'object') {
    const schema = raw.schemaIntegration as Record<string, unknown>;
    config.schemaIntegration = {
      enabled: typeof schema.enabled === 'boolean' ? schema.enabled : false,
      schemaPath: typeof schema.schemaPath === 'string'
        ? schema.schemaPath
        : DEFAULT_CONFIG.schemaIntegration.schemaPath,
    };
  }

  return config;
}

function parseSeverity(value: string): vscode.DiagnosticSeverity {
  switch (value.toLowerCase()) {
    case 'error': return vscode.DiagnosticSeverity.Error;
    case 'warning': return vscode.DiagnosticSeverity.Warning;
    case 'information': return vscode.DiagnosticSeverity.Information;
    case 'hint': return vscode.DiagnosticSeverity.Hint;
    default: return vscode.DiagnosticSeverity.Warning;
  }
}

export function watchConfig(
  workspaceRoot: string | undefined,
  onChange: (config: EnvSenseiConfig) => void
): vscode.Disposable {
  if (!workspaceRoot) return { dispose: () => {} };

  const pattern = new vscode.RelativePattern(workspaceRoot, CONFIG_FILE_NAME);
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  const reload = () => {
    const config = loadConfig(workspaceRoot);
    onChange(config);
  };

  watcher.onDidChange(reload);
  watcher.onDidCreate(reload);
  watcher.onDidDelete(reload);

  return watcher;
}
