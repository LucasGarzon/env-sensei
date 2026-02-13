import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EnvSenseiConfig } from '../types';
import { DEFAULT_CONFIG } from '../constants';

const CONFIG_FILE_NAME = '.envsenseirc.json';

export function loadConfig(workspaceRoot: string | undefined): EnvSenseiConfig {
  const fromVsCode = loadConfigFromVSCode();
  if (!workspaceRoot) return fromVsCode;

  const configPath = path.join(workspaceRoot, CONFIG_FILE_NAME);
  if (!fs.existsSync(configPath)) return fromVsCode;

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return mergeConfig(parsed, fromVsCode);
  } catch {
    return fromVsCode;
  }
}

function loadConfigFromVSCode(): EnvSenseiConfig {
  const config = { ...DEFAULT_CONFIG };
  const vscodeConfig = vscode.workspace.getConfiguration('envSensei');

  const envExampleFileName = vscodeConfig.get<string>('envExampleFileName');
  if (typeof envExampleFileName === 'string') {
    config.envExampleFileName = envExampleFileName;
  }

  const severitySecrets = vscodeConfig.get<string>('severitySecrets');
  if (typeof severitySecrets === 'string') {
    config.severitySecrets = parseSeverity(severitySecrets);
  }

  const severityConfig = vscodeConfig.get<string>('severityConfig');
  if (typeof severityConfig === 'string') {
    config.severityConfig = parseSeverity(severityConfig);
  }

  const ignoredGlobs = vscodeConfig.get<string[]>('ignoredGlobs');
  if (Array.isArray(ignoredGlobs)) {
    config.ignoredGlobs = ignoredGlobs.filter(
      (glob): glob is string => typeof glob === 'string'
    );
  }

  const ignoredWords = vscodeConfig.get<string[]>('ignoredWords');
  if (Array.isArray(ignoredWords)) {
    config.ignoredWords = ignoredWords.filter(
      (word): word is string => typeof word === 'string'
    );
  }

  const envVarPrefix = vscodeConfig.get<string>('envVarPrefix');
  if (typeof envVarPrefix === 'string') {
    config.envVarPrefix = envVarPrefix;
  }

  const insertFallback = vscodeConfig.get<boolean>('insertFallback');
  if (typeof insertFallback === 'boolean') {
    config.insertFallback = insertFallback;
  }

  const schemaEnabled = vscodeConfig.get<boolean>('schemaIntegration.enabled');
  const schemaPath = vscodeConfig.get<string>('schemaIntegration.schemaPath');
  config.schemaIntegration = {
    enabled: typeof schemaEnabled === 'boolean'
      ? schemaEnabled
      : DEFAULT_CONFIG.schemaIntegration.enabled,
    schemaPath: typeof schemaPath === 'string'
      ? schemaPath
      : DEFAULT_CONFIG.schemaIntegration.schemaPath,
  };

  return config;
}

function mergeConfig(raw: Record<string, unknown>, baseConfig: EnvSenseiConfig): EnvSenseiConfig {
  const config = { ...baseConfig };

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
    const ignoredGlobs = raw.ignoredGlobs.filter(
      (g): g is string => typeof g === 'string'
    );
    config.ignoredGlobs = Array.from(new Set([...config.ignoredGlobs, ...ignoredGlobs]));
  }
  if (Array.isArray(raw.ignoredWords)) {
    const ignoredWords = raw.ignoredWords.filter(
      (word): word is string => typeof word === 'string'
    );
    config.ignoredWords = Array.from(new Set([...config.ignoredWords, ...ignoredWords]));
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
