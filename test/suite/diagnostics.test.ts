import * as assert from 'assert';
import * as ts from 'typescript';
import { Detector } from '../../src/detection/detector';
import { DEFAULT_CONFIG } from '../../src/constants';

function createSourceFile(code: string): ts.SourceFile {
  return ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
}

suite('Diagnostics Integration', () => {
  const detector = new Detector(DEFAULT_CONFIG);

  test('marks AWS key as secret (should be Error severity)', () => {
    // Variable name contains "key" → key-based detector matches first (dedup by range)
    const code = 'const awsKey = "AKIAIOSFODNN7EXAMPLE";';
    const sf = createSourceFile(code);
    const detections = detector.analyze(sf);

    assert.strictEqual(detections.length, 1);
    assert.strictEqual(detections[0].category, 'secret');
    // key-based wins because it runs before pattern-based and dedup keeps first match
    assert.ok(['key-based', 'pattern-based'].includes(detections[0].source));
    assert.ok(detections[0].message.includes('REDACTED'));
    assert.ok(!detections[0].message.includes('AKIAIOSFODNN7EXAMPLE'));
  });

  test('marks baseUrl as config (should be Warning severity)', () => {
    const code = 'const baseUrl = "https://api.example.com";';
    const sf = createSourceFile(code);
    const detections = detector.analyze(sf);

    assert.strictEqual(detections.length, 1);
    assert.strictEqual(detections[0].category, 'config');
    // May match via config-based (name) or pattern-based (URL value) — both are valid
    assert.ok(['config-based', 'pattern-based'].includes(detections[0].source));
    assert.strictEqual(detections[0].proposedEnvVarName, 'BASE_URL');
  });

  test('detects multiple issues in one file', () => {
    const code = `
const jwtSecret = "my-super-secret-jwt-key";
const apiKey = "sk-1234567890abcdefghijklmnop";
const databaseUrl = "mongodb://localhost:27017/mydb";
const headers = {
  Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
  "X-Api-Key": "secret-api-key-value-12345"
};
const userName = "John Doe";
const appTitle = "My App";
`;
    const sf = createSourceFile(code);
    const detections = detector.analyze(sf);

    // Should detect: jwtSecret, apiKey (sk- pattern), databaseUrl, Authorization header, X-Api-Key header
    // Should NOT detect: userName, appTitle
    assert.ok(detections.length >= 4, `Expected at least 4 detections, got ${detections.length}`);

    const envVarNames = detections.map(d => d.proposedEnvVarName);
    assert.ok(envVarNames.includes('JWT_SECRET'), 'Should detect JWT_SECRET');
    assert.ok(envVarNames.includes('DATABASE_URL'), 'Should detect DATABASE_URL');

    // Verify no detection contains raw secret values
    for (const d of detections) {
      assert.ok(d.message.includes('REDACTED'), `Message should be redacted: ${d.message}`);
      assert.ok(!d.message.includes('my-super-secret'), 'Message must not contain raw secret');
    }

    // Verify categories
    const secretDetections = detections.filter(d => d.category === 'secret');
    const configDetections = detections.filter(d => d.category === 'config');
    assert.ok(secretDetections.length >= 3, 'Should have at least 3 secrets');
    assert.ok(configDetections.length >= 1, 'Should have at least 1 config');
  });

  test('provides correct env var name proposals', () => {
    const code = `
const clientSecret = "abcdef123456";
const mongoUri = "mongodb://localhost/test";
const privateKey = "-----BEGIN RSA PRIVATE KEY-----";
`;
    const sf = createSourceFile(code);
    const detections = detector.analyze(sf);

    const byName = new Map(detections.map(d => [d.proposedEnvVarName, d]));

    assert.ok(byName.has('CLIENT_SECRET'), 'Should propose CLIENT_SECRET');
    assert.ok(byName.has('MONGO_URI'), 'Should propose MONGO_URI');
    assert.ok(byName.has('PRIVATE_KEY'), 'Should propose PRIVATE_KEY');

    assert.strictEqual(byName.get('CLIENT_SECRET')!.category, 'secret');
    assert.strictEqual(byName.get('MONGO_URI')!.category, 'config');
    assert.strictEqual(byName.get('PRIVATE_KEY')!.category, 'secret');
  });

  test('detects hardcoded URLs in object properties', () => {
    const code = `
new RawAttachmentTemplate({
  name: "logo.png",
  path: "https://siga.catalisia.com/assets/logo.png",
  cid: "gsk",
});
`;
    const sf = createSourceFile(code);
    const detections = detector.analyze(sf);

    // "path" has a hardcoded URL → should be detected as config
    const urlDetection = detections.find(d => d._rawValue.includes('catalisia'));
    assert.ok(urlDetection, 'Should detect hardcoded URL in path property');
    assert.strictEqual(urlDetection!.category, 'config');
    assert.ok(urlDetection!.message.includes('REDACTED'));
  });

  test('detects any hardcoded non-localhost URL', () => {
    const code = `
const imgSrc = "https://cdn.example.com/image.png";
const localApi = "http://localhost:3000/api";
`;
    const sf = createSourceFile(code);
    const detections = detector.analyze(sf);

    // External URL should be detected, localhost should NOT
    const externalDetection = detections.find(d => d._rawValue.includes('cdn.example'));
    assert.ok(externalDetection, 'Should detect external URL');
    assert.strictEqual(externalDetection!.category, 'config');

    const localhostDetection = detections.find(d => d._rawValue.includes('localhost'));
    assert.ok(!localhostDetection, 'Should NOT detect localhost URL');
  });

  test('does not flag safe code', () => {
    const code = `
const name = "Alice";
const greeting = "Hello, world!";
const count = 42;
const isEnabled = true;
const items = ["apple", "banana"];
`;
    const sf = createSourceFile(code);
    const detections = detector.analyze(sf);
    assert.strictEqual(detections.length, 0, 'Safe code should have zero detections');
  });

  test('skips detections when ignored word matches identifier', () => {
    const code = 'const internalTestToken = "secret-value-123";';
    const sf = createSourceFile(code);
    const customDetector = new Detector({
      ...DEFAULT_CONFIG,
      ignoredWords: ['internalTest'],
    });
    const detections = customDetector.analyze(sf);
    assert.strictEqual(detections.length, 0, 'Should ignore match by identifier');
  });

  test('skips detections when ignored word matches literal value', () => {
    const code = 'const jwtSecret = "dummy-secret-for-tests";';
    const sf = createSourceFile(code);
    const customDetector = new Detector({
      ...DEFAULT_CONFIG,
      ignoredWords: ['dummy-secret'],
    });
    const detections = customDetector.analyze(sf);
    assert.strictEqual(detections.length, 0, 'Should ignore match by literal value');
  });
});
