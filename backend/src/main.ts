import 'dotenv/config';
import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppLoggerService } from './infrastructure/logging/logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configuredOrigins = (process.env.CORS_ORIGIN ?? '*')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isWildcard = configuredOrigins.includes('*');
      const isConfigured = configuredOrigins.includes(origin);
      const isLocalhost = /^https?:\/\/localhost(:\d+)?$/i.test(origin);
      const isLocalIp = /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin);

      if (isWildcard || isConfigured || isLocalhost || isLocalIp) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
  });
  app.enableShutdownHooks();
  app.setGlobalPrefix(process.env.API_PREFIX ?? 'api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useLogger(app.get(AppLoggerService));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
