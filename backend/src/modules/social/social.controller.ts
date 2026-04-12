import { Body, Controller, Get, Post } from '@nestjs/common';

import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { SocialService } from './social.service';

@Controller()
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('friends')
  getFriends(): Promise<void> {
    return this.socialService.getFriends();
  }

  @Post('friends/requests')
  createFriendRequest(@Body() dto: CreateFriendRequestDto): Promise<void> {
    return this.socialService.createFriendRequest(dto);
  }

  @Get('follows')
  getFollows(): Promise<void> {
    return this.socialService.getFollows();
  }

  @Get('blocks')
  getBlocks(): Promise<void> {
    return this.socialService.getBlocks();
  }
}
