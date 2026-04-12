import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  Body,
} from '@nestjs/common';

import { CurrentUserDecorator } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { MarkAllNotificationsReadDto } from './dto/mark-all-notifications-read.dto';
import { MarkNotificationReadDto } from './dto/mark-notification-read.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationsService } from './notifications.service';

interface NotificationUserContext {
  id: string;
  schoolId: string;
  roles: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listNotifications(
    @CurrentUserDecorator() user: NotificationUserContext,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notificationsService.listNotifications(user, query);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUserDecorator() user: NotificationUserContext) {
    return this.notificationsService.getUnreadCount(user);
  }

  @Patch(':id/read')
  markAsRead(
    @CurrentUserDecorator() user: NotificationUserContext,
    @Param('id') notificationId: string,
    @Body() dto: MarkNotificationReadDto,
  ) {
    return this.notificationsService.markAsRead(user, notificationId, dto);
  }

  @Patch('read-all')
  markAllAsRead(
    @CurrentUserDecorator() user: NotificationUserContext,
    @Body() dto: MarkAllNotificationsReadDto,
  ) {
    return this.notificationsService.markAllAsRead(user, dto);
  }

  @Get('preferences')
  getPreferences(@CurrentUserDecorator() user: NotificationUserContext) {
    return this.notificationsService.getPreferences(user);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUserDecorator() user: NotificationUserContext,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user, dto);
  }
}
