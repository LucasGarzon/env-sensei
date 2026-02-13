import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { readEnvExample, addToEnvExample } from '../../src/env/envFileUpdater';

suite('envFileUpdater', () => {
  let tmpDir: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-sensei-test-'));
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('readEnvExample parses entries correctly', () => {
    const filePath = path.join(tmpDir, '.env.example');
    fs.writeFileSync(filePath, 'API_KEY=__REQUIRED__\nDATABASE_URL=__SET_ME__\n# comment\n\nREDIS_URL=\n');

    const entries = readEnvExample(filePath);
    assert.strictEqual(entries.length, 3);
    assert.strictEqual(entries[0].key, 'API_KEY');
    assert.strictEqual(entries[0].value, '__REQUIRED__');
    assert.strictEqual(entries[1].key, 'DATABASE_URL');
    assert.strictEqual(entries[1].value, '__SET_ME__');
    assert.strictEqual(entries[2].key, 'REDIS_URL');
  });

  test('readEnvExample returns empty for missing file', () => {
    const entries = readEnvExample(path.join(tmpDir, 'nonexistent'));
    assert.strictEqual(entries.length, 0);
  });

  test('addToEnvExample creates file with placeholder for secret', async () => {
    const filePath = path.join(tmpDir, '.env.example');
    await addToEnvExample(filePath, 'JWT_SECRET', 'secret');

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('JWT_SECRET=__REQUIRED__'));
    // Must NOT contain any real secret value
    assert.ok(!content.includes('my-actual-secret'));
  });

  test('addToEnvExample uses __SET_ME__ for config', async () => {
    const filePath = path.join(tmpDir, '.env.example');
    await addToEnvExample(filePath, 'DATABASE_URL', 'config');

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('DATABASE_URL=__SET_ME__'));
  });

  test('addToEnvExample appends to existing file', async () => {
    const filePath = path.join(tmpDir, '.env.example');
    fs.writeFileSync(filePath, 'EXISTING_VAR=value\n');

    await addToEnvExample(filePath, 'NEW_VAR', 'secret');

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('EXISTING_VAR=value'));
    assert.ok(content.includes('NEW_VAR=__REQUIRED__'));
  });

  test('addToEnvExample does not duplicate existing keys', async () => {
    const filePath = path.join(tmpDir, '.env.example');
    fs.writeFileSync(filePath, 'API_KEY=__REQUIRED__\n');

    await addToEnvExample(filePath, 'API_KEY', 'secret');

    const content = fs.readFileSync(filePath, 'utf-8');
    const matches = content.match(/API_KEY/g);
    assert.strictEqual(matches?.length, 1, 'Should not duplicate API_KEY');
  });

  test('addToEnvExample never writes real secret values', async () => {
    const filePath = path.join(tmpDir, '.env.example');

    // Simulate adding multiple vars — none should have real values
    await addToEnvExample(filePath, 'SECRET_TOKEN', 'secret');
    await addToEnvExample(filePath, 'MONGO_URI', 'config');

    const content = fs.readFileSync(filePath, 'utf-8');

    // Only placeholders allowed
    const lines = content.trim().split('\n');
    for (const line of lines) {
      const value = line.split('=')[1];
      assert.ok(
        value === '__REQUIRED__' || value === '__SET_ME__',
        `Unexpected value in .env.example: "${value}"`
      );
    }
  });
});
