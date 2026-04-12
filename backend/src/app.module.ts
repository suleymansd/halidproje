import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AuthModule } from './modules/auth/auth.module';
import { AcademicMaterialsModule } from './modules/academic-materials/academic-materials.module';
import { AuditModule } from './modules/audit/audit.module';
import { CoursesModule } from './modules/courses/courses.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { GroupsModule } from './modules/groups/groups.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { SearchModule } from './modules/search/search.module';
import { SocialModule } from './modules/social/social.module';
import { UsersModule } from './modules/users/users.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ConfigModule } from './infrastructure/config/config.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HealthModule } from './infrastructure/health/health.module';
import { LoggerModule } from './infrastructure/logging/logger.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RateLimitModule } from './infrastructure/rate-limit/rate-limit.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { SecurityModule } from './infrastructure/security/security.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    StorageModule,
    QueueModule,
    RedisModule,
    LoggerModule,
    RateLimitModule,
    SecurityModule,
    HealthModule,
    SharedModule,
    AcademicMaterialsModule,
    AuthModule,
    UsersModule,
    SchoolsModule,
    SearchModule,
    DepartmentsModule,
    CoursesModule,
    SocialModule,
    MessagingModule,
    GroupsModule,
    MaterialsModule,
    NotificationsModule,
    ModerationModule,
    AuditModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
