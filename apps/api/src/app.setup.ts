import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createValidationPipe } from './common/pipes/validation.pipe';
import {
  UPLOADS_ROUTE,
  resolveUploadDir,
} from './common/utils/upload-dir.util';
import type { Env } from './config/env.validation';

/** Every route lives under `/api/v1` (contract header). */
export const API_PREFIX = 'api/v1';

/** JSON body cap. The largest JSON body is a bulk update (200 UUIDs); photos are multipart. */
export const JSON_BODY_LIMIT = '1mb';

/** App-level wiring shared by main.ts and the e2e tests, so both run the same app. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  (app as NestExpressApplication).useBodyParser('json', {
    limit: JSON_BODY_LIMIT,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();
  if (config.get('STORAGE_DRIVER', { infer: true }) === 'local')
    serveLocalUploads(app as NestExpressApplication, config);
}

/**
 * Local photo files at /uploads/* � public on purpose (business �6.10: photo links are sent to
 * workers on WhatsApp and open without an account). Express static runs before Nest's guards;
 * the keys are unguessable UUID paths and there is no directory listing.
 */
function serveLocalUploads(
  app: NestExpressApplication,
  config: ConfigService<Env, true>,
): void {
  app.useStaticAssets(
    resolveUploadDir(config.get('UPLOAD_DIR', { infer: true })),
    {
      prefix: UPLOADS_ROUTE,
      index: false,
      dotfiles: 'deny',
      redirect: false,
      immutable: true,
      maxAge: '365d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    },
  );
}
