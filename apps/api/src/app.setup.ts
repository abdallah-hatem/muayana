import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createValidationPipe } from './common/pipes/validation.pipe';
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
}
