import * as assert from 'assert';
import * as ts from 'typescript';
import { KeyBasedDetector } from '../../src/detection/keyBasedDetector';

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

suite('KeyBasedDetector', () => {
  const detector = new KeyBasedDetector();

  test('detects variable named jwtSecret', () => {
    const code = 'const jwtSecret = "mysecretvalue123";';
    const sf = createSourceFile(code);
    const literals = findStringLiterals(sf);
    const detections = detector.detect(sf, literals[0]);
    assert.strictEqual(detections.length, 1);
    assert.strictEqual(detections[0].proposedEnvVarName, 'JWT_SECRET');
    assert.strictEqual(detections[0].category, 'secret');
  });

  test('detects property named apiKey', () => {
    const code = 'const config = { apiKey: "abc123" };';
    const sf = createSourceFile(code);
    const literals = findStringLiterals(sf);
    const detections = detector.detect(sf, literals[0]);
    assert.strictEqual(detections.length, 1);
    assert.strictEqual(detections[0].proposedEnvVarName, 'API_KEY');
  });

  test('detects password variable', () => {
    const code = 'const dbPassword = "secretpass";';
    const sf = createSourceFile(code);
    const literals = findStringLiterals(sf);
    const detections = detector.detect(sf, literals[0]);
    assert.strictEqual(detections.length, 1);
    assert.ok(detections[0].proposedEnvVarName.includes('PASSWORD'));
  });

  test('ignores normal variable names', () => {
    const code = 'const userName = "John";';
    const sf = createSourceFile(code);
    const literals = findStringLiterals(sf);
    const detections = detector.detect(sf, literals[0]);
    assert.strictEqual(detections.length, 0);
  });

  test('ignores short values', () => {
    const code = 'const token = "";';
    const sf = createSourceFile(code);
    const literals = findStringLiterals(sf);
    const detections = detector.detect(sf, literals[0]);
    assert.strictEqual(detections.length, 0);
  });

  test('never exposes raw value in message', () => {
    const code = 'const jwtSecret = "supersecretvalue";';
    const sf = createSourceFile(code);
    const literals = findStringLiterals(sf);
    const detections = detector.detect(sf, literals[0]);
    assert.strictEqual(detections.length, 1);
    assert.ok(!detections[0].message.includes('supersecretvalue'));
    assert.ok(detections[0].message.includes('REDACTED'));
  });
});
