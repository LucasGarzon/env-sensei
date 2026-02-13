# Env Sensei

Extensión para VSCode y Cursor que detecta secrets y configuraciones hardcodeadas en archivos TypeScript/JavaScript, y ofrece quick fixes para extraerlos a variables de entorno.

## Features

### Detección automática

Env Sensei analiza tu código en tiempo real y marca:

- **Secrets** (severity: Error) — variables con nombres como `token`, `secret`, `apiKey`, `password`, `jwt`, `clientSecret`, `privateKey`, `credential`
- **Headers sensibles** (severity: Error) — valores literales en `Authorization`, `X-Api-Key`, `Cookie`, `Set-Cookie`
- **Patrones conocidos** (severity: Error) — AWS keys (`AKIA...`), private key headers, Bearer tokens, JWT-like strings, claves `sk-`
- **Configuración** (severity: Warning) — `baseUrl`, `apiUrl`, `endpoint`, `host`, `mongoUri`, `databaseUrl`, `redisUrl` con valores hardcodeados

### Quick Fixes (Code Actions)

Al hacer click en el lightbulb (o `Ctrl+.` / `Cmd+.`):

1. **"Extract to env var: VAR_NAME"** — Reemplaza el literal por `process.env.VAR_NAME` y agrega `VAR_NAME=__REQUIRED__` al `.env.example`
2. **"Add to .env.example: VAR_NAME"** — Solo agrega la entrada al `.env.example` sin modificar el código
3. **"Add to env schema (Zod): VAR_NAME"** — Agrega la variable al schema Zod (requiere `schemaIntegration.enabled` en config)

### Inventory Scanner

Comando: `Env Sensei: Scan Env Var Inventory` (`Ctrl+Shift+P`)

- Detecta `process.env.X` usado en código pero ausente en `.env.example` → warning
- Detecta variables definidas en `.env.example` pero no usadas en código → info

### Ejemplo: antes y después

**Antes:**
```typescript
const jwtSecret = "mi-valor-secreto";
const baseUrl = "https://api.ejemplo.com";
const headers = {
  Authorization: "Bearer token-largo-aqui"
};
```

**Después de aplicar quick fixes:**
```typescript
const jwtSecret = process.env.JWT_SECRET;
const baseUrl = process.env.BASE_URL;
const headers = {
  Authorization: process.env.AUTHORIZATION
};
```

**`.env.example` generado:**
```
JWT_SECRET=__REQUIRED__
BASE_URL=__SET_ME__
AUTHORIZATION=__REQUIRED__
```

### Seguridad

- Nunca muestra el valor real del string en los mensajes de diagnóstico — solo `[REDACTED: N chars]`
- Nunca escribe secretos reales en `.env.example` — solo placeholders

## Desarrollo

### Requisitos

- Node.js >= 18
- VSCode >= 1.74 o Cursor

### Setup

```bash
npm install
npm run compile
```

### Correr en modo dev

1. Abrí el proyecto en VSCode/Cursor
2. Presioná **F5** para lanzar el Extension Development Host
3. En la ventana que se abre, editá un archivo `.ts` o `.js` con valores hardcodeados

### Comandos

```bash
npm run compile    # Compilar TypeScript
npm run watch      # Compilar en modo watch (incremental)
npm run lint       # ESLint
npm test           # Correr tests
npm run package    # Generar archivo .vsix para instalar en VSCode/Cursor
```

### Generar el paquete de instalación

Para instalar la extensión en VSCode o Cursor sin publicarla en el marketplace:

1. Generá el archivo `.vsix`:
   ```bash
   npm run package
   ```

2. Instalalo en VSCode/Cursor:
   - **Por UI:** `Cmd+Shift+X` → menú `...` → "Install from VSIX" → seleccioná `env-sensei-0.1.0.vsix`
   - **Por CLI:** `cursor --install-extension env-sensei-0.1.0.vsix`

### Tests

Los tests corren con Mocha dentro del Extension Development Host:

```bash
npm test
```

## Configuración

Creá un archivo `.envsenseirc.json` en la raíz del workspace:

```json
{
  "envExampleFileName": ".env.example",
  "severitySecrets": "error",
  "severityConfig": "warning",
  "ignoredGlobs": ["**/generated/**"],
  "ignoredWords": ["mockToken", "dummySecret"],
  "envVarPrefix": "APP_",
  "insertFallback": false,
  "schemaIntegration": {
    "enabled": false,
    "schemaPath": "src/env.schema.ts"
  }
}
```

| Opción | Default | Descripción |
|--------|---------|-------------|
| `envExampleFileName` | `.env.example` | Nombre del archivo de env example |
| `severitySecrets` | `"error"` | Severity para secrets detectados (`error`, `warning`, `information`, `hint`) |
| `severityConfig` | `"warning"` | Severity para configs detectadas |
| `ignoredGlobs` | `[]` | Globs adicionales a ignorar (además de `node_modules`, `dist`, `build`, `.next`, `coverage`) |
| `ignoredWords` | `[]` | Palabras a ignorar en detección. Si aparecen en identificador o valor literal, no se genera diagnóstico |
| `envVarPrefix` | `""` | Prefijo para nombres de env vars generados (ej: `APP_`) |
| `insertFallback` | `false` | Si es `true`, genera `process.env.VAR ?? ""` en vez de `process.env.VAR` |
| `schemaIntegration.enabled` | `false` | Habilita la code action "Add to env schema (Zod)" |
| `schemaIntegration.schemaPath` | `src/env.schema.ts` | Ruta al archivo de schema Zod |

La configuración se recarga automáticamente al modificar el archivo.

También podés configurar opciones a nivel usuario o workspace desde VSCode/Cursor en `settings.json` con el prefijo `envSensei.*`.

Ejemplo para palabras ignoradas:

```json
{
  "envSensei.ignoredWords": ["internalTestToken", "myLocalValue"]
}
```

Si además definís `ignoredWords` en `.envsenseirc.json`, ambas listas se combinan (sin duplicados). Esto permite tener una base global en User y sumar excepciones por proyecto.

Tip: desde un diagnóstico también podés usar Quick Fix con un click:
- `Ignore "<word>" in workspace settings`
- `Ignore "<word>" in user settings`
