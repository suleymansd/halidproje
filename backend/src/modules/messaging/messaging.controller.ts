import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserDecorator } from '../../shared/decorators/current-user.decorator';
import { ChatUserContext } from './interfaces/chat-user-context.interface';
import { CreatePrivateRoomDto } from './dto/create-private-room.dto';
import { ListRoomMessagesDto } from './dto/list-room-messages.dto';
import { ListUserRoomsDto } from './dto/list-user-rooms.dto';
import { MarkRoomAsReadDto } from './dto/mark-room-read.dto';
import { ReportMessageDto } from './dto/report-message.dto';
import { MessagingService } from './messaging.service';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('rooms')
  listUserRooms(
    @CurrentUserDecorator() user: ChatUserContext,
    @Query() query: ListUserRoomsDto,
  ) {
    return this.messagingService.listUserRooms(user, query);
  }

  @Get('rooms/:roomId')
  getRoomById(
    @CurrentUserDecorator() user: ChatUserContext,
    @Param('roomId') roomId: string,
  ) {
    return this.messagingService.getRoomById(user, roomId);
  }

  @Get('rooms/:roomId/messages')
  getRoomMessages(
    @CurrentUserDecorator() user: ChatUserContext,
    @Param('roomId') roomId: string,
    @Query() query: ListRoomMessagesDto,
  ) {
    return this.messagingService.getRoomMessages(user, roomId, query);
  }

  @Post('rooms/private')
  createPrivateRoom(
    @CurrentUserDecorator() user: ChatUserContext,
    @Body() dto: CreatePrivateRoomDto,
  ) {
    return this.messagingService.createOrGetPrivateRoom(user, dto);
  }

  @Patch('rooms/:roomId/read')
  markRoomAsRead(
    @CurrentUserDecorator() user: ChatUserContext,
    @Param('roomId') roomId: string,
    @Body() dto: MarkRoomAsReadDto,
  ) {
    return this.messagingService.markRoomAsRead(user, roomId, dto);
  }

  @Post('messages/:messageId/report')
  reportMessage(
    @CurrentUserDecorator() user: ChatUserContext,
    @Param('messageId') messageId: string,
    @Body() dto: ReportMessageDto,
  ) {
    return this.messagingService.reportMessage(user, messageId, dto);
  }
}
