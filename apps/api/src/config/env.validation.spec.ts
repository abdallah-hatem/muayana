import { validateEnv } from './env.validation';

const valid = {
  NODE_ENV: 'test',
  PORT: '3101',
  DATABASE_URL: 'postgresql://user:pass@localhost:5442/db',
  JWT_SECRET: 'x'.repeat(32),
  CORS_ORIGINS: 'http://localhost:3100, https://muayana.example.com',
  PUBLIC_UPLOAD_BASE_URL: 'http://localhost:3101/uploads',
};

describe('validateEnv', () => {
  it('parses a complete environment', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(3101);
    expect(env.STORAGE_DRIVER).toBe('local');
    expect(env.UPLOAD_DIR).toBe('uploads');
    expect(env.CORS_ORIGINS).toEqual([
      'http://localhost:3100',
      'https://muayana.example.com',
    ]);
  });

  it.each(['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGINS'])(
    'fails when %s is missing',
    (key) => {
      const { [key]: _removed, ...rest } = valid as Record<string, string>;
      expect(() => validateEnv(rest)).toThrow(key);
    },
  );

  it('defaults PORT to 3101 when unset', () => {
    const { PORT: _port, ...rest } = valid;
    expect(validateEnv(rest).PORT).toBe(3101);
  });

  it('rejects a PORT that is not a port number', () => {
    expect(() => validateEnv({ ...valid, PORT: '70000' })).toThrow('PORT');
  });

  it('rejects a short JWT secret', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'short' })).toThrow(
      'JWT_SECRET',
    );
  });

  it('rejects a CORS origin that is not a URL', () => {
    expect(() => validateEnv({ ...valid, CORS_ORIGINS: 'localhost' })).toThrow(
      'CORS_ORIGINS',
    );
  });

  it('needs PUBLIC_UPLOAD_BASE_URL with the local storage driver', () => {
    const { PUBLIC_UPLOAD_BASE_URL: _url, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow('PUBLIC_UPLOAD_BASE_URL');
  });

  it('needs BLOB_READ_WRITE_TOKEN with the blob storage driver', () => {
    expect(() => validateEnv({ ...valid, STORAGE_DRIVER: 'blob' })).toThrow(
      'BLOB_READ_WRITE_TOKEN',
    );
    expect(
      validateEnv({
        ...valid,
        STORAGE_DRIVER: 'blob',
        BLOB_READ_WRITE_TOKEN: 'token',
      }).STORAGE_DRIVER,
    ).toBe('blob');
  });

  it('rejects an unknown storage driver', () => {
    expect(() => validateEnv({ ...valid, STORAGE_DRIVER: 's3' })).toThrow(
      'STORAGE_DRIVER',
    );
  });

  it('TRUST_PROXY defaults to false and reads "true"', () => {
    expect(validateEnv(valid).TRUST_PROXY).toBe(false);
    expect(validateEnv({ ...valid, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(
      true,
    );
    expect(() => validateEnv({ ...valid, TRUST_PROXY: 'yes' })).toThrow(
      'TRUST_PROXY',
    );
  });
});
