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

  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? '*')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
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
