import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { Env } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<Env, true>);
  const prefix = config.get('API_PREFIX', { infer: true });

  // Behind nginx: trust X-Forwarded-For so rate limiting and iyzico see the real client IP.
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  if (trustProxy > 0) app.set('trust proxy', trustProxy);

  app.setGlobalPrefix(prefix, { exclude: ['health'] });
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';
  const swagger = !isProd || config.get('SWAGGER_ENABLED', { infer: true });
  app.use(
    helmet({
      // JSON API: nothing may be embedded or executed. Swagger UI (dev / opt-in) needs inline assets.
      contentSecurityPolicy: swagger
        ? { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], frameAncestors: ["'none'"] } }
        : { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // /uploads are embedded by web + admin
      referrerPolicy: { policy: 'no-referrer' },
      hsts: false, // nginx terminates TLS and sets HSTS
    }),
  );
  app.useBodyParser('json', { limit: '2mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' }); // iyzico callback is form-encoded

  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || origins.includes('*') || origins.includes(origin)),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Cart-Token', 'Accept-Language'],
    exposedHeaders: ['X-Cart-Token'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Uploaded media. In production nginx serves this folder directly; this is the dev fallback.
  app.useStaticAssets(resolve(config.get('UPLOAD_DIR', { infer: true })), { prefix: '/uploads/', maxAge: '30d', immutable: true });

  if (swagger) {
    const doc = new DocumentBuilder()
      .setTitle('MAEYJA API')
      .setDescription('Storefront, account, checkout and admin endpoints. Responses are wrapped as `{ success, data }`.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, doc));
  }

  app.enableShutdownHooks();
  const port = config.get('PORT', { infer: true });
  const host = config.get('LISTEN_HOST', { infer: true });
  await app.listen(port, host);
  Logger.log(`MAEYJA API listening on ${host}:${port}/${prefix}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start', err);
  process.exit(1);
});
