import * as vscode from "vscode";
import { EnvSenseiConfig, DetectionCategory } from "./types";

export const SECRET_KEY_PATTERNS: string[] = [
  // generic
  "secret",
  "secrets",
  "token",
  "tokens",
  "apikey",
  "api_key",
  "api-key",
  "api key",
  "password",
  "passwd",
  "pass",
  "pwd",
  "credential",
  "credentials",
  "creds",

  // auth / sessions
  "auth",
  "authorization",
  "bearer",
  "session",
  "sessionid",
  "session_id",
  "sid",
  "cookie",
  "cookies",
  "set-cookie",
  "refresh",
  "refresh_token",
  "access",
  "access_token",
  "id_token",
  "csrf",
  "csrf_token",
  "xsrf",
  "xsrf_token",
  "otp",
  "mfa",
  "totp",

  // jwt / signatures
  "jwt",
  "jwtsecret",
  "jwt_secret",
  "signing",
  "signingkey",
  "signing_key",
  "signature",
  "sig",

  // crypto / keys
  "private",
  "privatekey",
  "private_key",
  "publickey",
  "public_key",
  "pem",
  "keystore",
  "key_store",
  "certificate",
  "cert",
  "crt",
  "ssh",
  "rsa",
  "ed25519",
  "encryption",
  "encrypt",
  "decrypt",

  // oauth-ish
  "clientsecret",
  "client_secret",
  "clientid",
  "client_id",

  // common headers / api auth
  "x-api-key",
  "x_api_key",
  "api_token",
  "api-token",
  "appkey",
  "app_key",

  // db-ish (ojo: puede dar falsos positivos)
  "dbpassword",
  "db_password",
  "dbuser",
  "db_user",
  "dbusername",
  "db_username",
];

export const SENSITIVE_HEADERS: string[] = [
  "authorization",
  "x-api-key",
  "cookie",
  "set-cookie",
];

export const CONFIG_KEY_PATTERNS: string[] = [
  "url",
  "baseurl",
  "apiurl",
  "endpoint",
  "host",
  "mongouri",
  "databaseurl",
  "redisurl",
  "uri",
  "href",
  "origin",
  "domain",
];

export const VALUE_PATTERNS: Array<{
  name: string;
  regex: RegExp;
  category: DetectionCategory;
}> = [
  { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/, category: "secret" },
  {
    name: "Private Key Header",
    regex: /-----BEGIN .* PRIVATE KEY-----/,
    category: "secret",
  },
  {
    name: "Bearer Token",
    regex: /^Bearer\s+[A-Za-z0-9\-._~+/]+=*$/,
    category: "secret",
  },
  {
    name: "SK- prefixed key",
    regex: /^sk-[A-Za-z0-9]{20,}$/,
    category: "secret",
  },
  {
    name: "JWT-like token",
    regex: /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/,
    category: "secret",
  },
  {
    name: "Hardcoded URL",
    regex: /^https?:\/\/(?!localhost\b)[^\s]+$/,
    category: "config",
  },
];

export const DEFAULT_IGNORED_GLOBS: string[] = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
];

export const DIAGNOSTIC_SOURCE = "Env Sensei";

export const DEFAULT_CONFIG: EnvSenseiConfig = {
  envExampleFileName: ".env.example",
  severitySecrets: vscode.DiagnosticSeverity.Error,
  severityConfig: vscode.DiagnosticSeverity.Warning,
  ignoredGlobs: [],
  ignoredWords: [],
  envVarPrefix: "",
  insertFallback: false,
  schemaIntegration: { enabled: false, schemaPath: "src/env.schema.ts" },
};
