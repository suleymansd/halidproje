import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

@Injectable()
export class AppLoggerService implements NestLoggerService {
  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(
    level: 'log' | 'error' | 'warn' | 'debug' | 'verbose',
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    const record = JSON.stringify({
      level,
      message,
      context: context ?? 'Application',
      trace,
      timestamp: new Date().toISOString(),
    });

    if (level === 'error') {
      process.stderr.write(`${record}\n`);
      return;
    }

    process.stdout.write(`${record}\n`);
  }
}
