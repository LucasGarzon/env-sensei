import * as assert from 'assert';
import * as ts from 'typescript';
import { PatternBasedDetector } from '../../src/detection/patternBasedDetector';

function createSourceFile(code: string): ts.SourceFile {
  return ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
}

function findStringLiterals(sourceFile: ts.SourceFile): ts.StringLiteral[] {
  const literals: ts.StringLiteral[] = [];
  function visit(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.StringLiteral) {
      literals.push(node as ts.StringLiteral);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return literals;
}

suite('PatternBasedDetector', () => {
  const detector = new PatternBasedDetector();

  test('detects AWS Access Key', () => {
    const code = 'const key = "AKIAIOSFODNN7EXAMPLE";';
    const sf = createSourceFile(code);
    const literals = findStringLiterals(sf);
    assert.strictEqual(literals.length, 1);

    const detections = detector.detect(sf, literals[0]);
    assert.strictEqual(detections.length, 1);
    assert.strictEqual(detections[0].source, 'pattern-based');
    assert.ok(detections[0].message.includes('AWS Access Key'));
    assert.ok(!detections[0].message.includes('AKIAIOSFODNN7EXAMPLE'));
  });

  test('detects Bearer token', () => {
    const code = 'const auth = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";';
    const sf = createSourceFile(code);
    const literals = findStringLiterals(sf);
    const detections = detector.detect(sf, literals[0]);
    assert.strictEqual(detections.length, 1);
    assert.ok(detections[0].message.includes('Bearer Token'));
  });

  test('detects sk- prefixed key', () => {
    const code = 'const key = "sk-1234567890abcdefghijklmnop";';
    const sf = createSourceFile(code);
    const literals = findStringLiterals(sf);
    const detections = detector.detect(sf, literals[0]);
    assert.strictEqual(detections.length, 1);
    assert.ok(detections[0].message.includes('SK-'));
  });

  test('detects private key header', () => {
    const code = 'const pem = "-----BEGIN RSA PRIVATE KEY-----";';
    const sf = createSourceFile(code);
    const literals = findStringLiterals(sf);
    const detections = detector.detect(sf, literals[0]);
    assert.strictEqual(detections.length, 1);
    assert.ok(detections[0].message.includes('Private Key'));
  });

  test('does not detect normal strings', () => {
    const code = 'const name = "hello world";';
    const sf = createSourceFile(code);
    const literals = findStringLiterals(sf);
    const detections = detector.detect(sf, literals[0]);
    assert.strictEqual(detections.length, 0);
  });

  test('never shows raw value in message', () => {
    const code = 'const key = "AKIAIOSFODNN7EXAMPLE";';
    const sf = createSourceFile(code);
    const literals = findStringLiterals(sf);
    const detections = detector.detect(sf, literals[0]);
    assert.strictEqual(detections.length, 1);
    assert.ok(!detections[0].message.includes('AKIAIOSFODNN7EXAMPLE'));
    assert.ok(detections[0].message.includes('REDACTED'));
  });
});
