import { Module } from '@nestjs/common';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ParseUuidPipe } from './pipes/parse-uuid.pipe';

@Module({
  providers: [JwtAuthGuard, RolesGuard, LoggingInterceptor, ParseUuidPipe],
  exports: [JwtAuthGuard, RolesGuard, LoggingInterceptor, ParseUuidPipe],
})
export class SharedModule {}
