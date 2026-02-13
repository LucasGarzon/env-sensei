import * as vscode from 'vscode';
import { EnvSenseiConfig, DetectionCategory } from './types';

export const SECRET_KEY_PATTERNS: string[] = [
  'secret', 'token', 'apikey', 'api_key', 'password',
  'authorization', 'bearer', 'jwt', 'privatekey', 'clientsecret',
  'passwd', 'credential',
];

export const SENSITIVE_HEADERS: string[] = [
  'authorization', 'x-api-key', 'cookie', 'set-cookie',
];

export const CONFIG_KEY_PATTERNS: string[] = [
  'url', 'baseurl', 'apiurl', 'endpoint', 'host',
  'mongouri', 'databaseurl', 'redisurl', 'uri',
  'href', 'origin', 'domain',
];

export const VALUE_PATTERNS: Array<{ name: string; regex: RegExp; category: DetectionCategory }> = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/, category: 'secret' },
  { name: 'Private Key Header', regex: /-----BEGIN .* PRIVATE KEY-----/, category: 'secret' },
  { name: 'Bearer Token', regex: /^Bearer\s+[A-Za-z0-9\-._~+/]+=*$/, category: 'secret' },
  { name: 'SK- prefixed key', regex: /^sk-[A-Za-z0-9]{20,}$/, category: 'secret' },
  { name: 'JWT-like token', regex: /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/, category: 'secret' },
  { name: 'Hardcoded URL', regex: /^https?:\/\/(?!localhost\b)[^\s]+$/, category: 'config' },
];

export const DEFAULT_IGNORED_GLOBS: string[] = [
  '**/node_modules/**', '**/dist/**', '**/build/**',
  '**/.next/**', '**/coverage/**',
];

export const DIAGNOSTIC_SOURCE = 'Env Sensei';

export const DEFAULT_CONFIG: EnvSenseiConfig = {
  envExampleFileName: '.env.example',
  severitySecrets: vscode.DiagnosticSeverity.Error,
  severityConfig: vscode.DiagnosticSeverity.Warning,
  ignoredGlobs: [],
  envVarPrefix: '',
  insertFallback: false,
  schemaIntegration: { enabled: false, schemaPath: 'src/env.schema.ts' },
};
