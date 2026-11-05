import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './app.setup';
import { UPLOADS_ROUTE } from './common/utils/upload-dir.util';

/** An app double that records configureApp's calls, reading `env` as its config. */
function fakeApp(env: Record<string, unknown>) {
  const config = { get: (key: string) => env[key] };
  const app = {
    get: jest.fn((token: unknown) => {
      if (token !== ConfigService) throw new Error('unexpected token');
      return config;
    }),
    useBodyParser: jest.fn(),
    set: jest.fn(),
    setGlobalPrefix: jest.fn(),
    enableCors: jest.fn(),
    useGlobalPipes: jest.fn(),
    enableShutdownHooks: jest.fn(),
    useStaticAssets: jest.fn(),
  };
  return app;
}

const base = {
  CORS_ORIGINS: ['http://localhost:3100'],
  TRUST_PROXY: false,
  UPLOAD_DIR: 'uploads',
};

describe('configureApp', () => {
  it('serves /uploads from disk with the local storage driver', () => {
    const app = fakeApp({ ...base, STORAGE_DRIVER: 'local' });
    configureApp(app as unknown as INestApplication);
    expect(app.useStaticAssets).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ prefix: UPLOADS_ROUTE, index: false }),
    );
  });

  it('serves no /uploads route with the blob storage driver', () => {
    const app = fakeApp({ ...base, STORAGE_DRIVER: 'blob' });
    configureApp(app as unknown as INestApplication);
    expect(app.useStaticAssets).not.toHaveBeenCalled();
  });

  it('trusts X-Forwarded-For only when TRUST_PROXY is on', () => {
    const off = fakeApp({ ...base, STORAGE_DRIVER: 'blob' });
    configureApp(off as unknown as INestApplication);
    expect(off.set).not.toHaveBeenCalled();

    const on = fakeApp({ ...base, STORAGE_DRIVER: 'blob', TRUST_PROXY: true });
    configureApp(on as unknown as INestApplication);
    expect(on.set).toHaveBeenCalledWith('trust proxy', true);
  });
});
