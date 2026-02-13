import * as assert from 'assert';
import { toEnvVarName } from '../../src/utils/naming';

suite('toEnvVarName', () => {
  test('camelCase → UPPER_SNAKE_CASE', () => {
    assert.strictEqual(toEnvVarName('jwtSecret'), 'JWT_SECRET');
    assert.strictEqual(toEnvVarName('apiKey'), 'API_KEY');
    assert.strictEqual(toEnvVarName('baseUrl'), 'BASE_URL');
    assert.strictEqual(toEnvVarName('databaseUrl'), 'DATABASE_URL');
  });

  test('PascalCase → UPPER_SNAKE_CASE', () => {
    assert.strictEqual(toEnvVarName('JwtSecret'), 'JWT_SECRET');
    assert.strictEqual(toEnvVarName('ApiKey'), 'API_KEY');
  });

  test('already UPPER_SNAKE_CASE stays the same', () => {
    assert.strictEqual(toEnvVarName('API_KEY'), 'API_KEY');
    assert.strictEqual(toEnvVarName('JWT_SECRET'), 'JWT_SECRET');
  });

  test('already snake_case → UPPER_SNAKE_CASE', () => {
    assert.strictEqual(toEnvVarName('api_key'), 'API_KEY');
    assert.strictEqual(toEnvVarName('jwt_secret'), 'JWT_SECRET');
  });

  test('single word', () => {
    assert.strictEqual(toEnvVarName('token'), 'TOKEN');
    assert.strictEqual(toEnvVarName('password'), 'PASSWORD');
  });

  test('with prefix', () => {
    assert.strictEqual(toEnvVarName('jwtSecret', 'APP_'), 'APP_JWT_SECRET');
    assert.strictEqual(toEnvVarName('apiKey', 'APP'), 'APP_API_KEY');
  });

  test('complex cases', () => {
    assert.strictEqual(toEnvVarName('mongoUri'), 'MONGO_URI');
    assert.strictEqual(toEnvVarName('redisUrl'), 'REDIS_URL');
    assert.strictEqual(toEnvVarName('clientSecret'), 'CLIENT_SECRET');
  });
});
