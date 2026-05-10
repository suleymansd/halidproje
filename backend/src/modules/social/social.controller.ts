import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUserDecorator, CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';
import { SocialService } from './social.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('friends')
  getFriends(@CurrentUserDecorator() user: CurrentUser) {
    return this.socialService.getFriends(user);
  }

  @Post('friends/requests')
  createFriendRequest(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateFriendRequestDto,
  ) {
    return this.socialService.createFriendRequest(user, dto);
  }

  @Patch('friends/requests/:requestId')
  respondToFriendRequest(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('requestId') requestId: string,
    @Body() dto: RespondFriendRequestDto,
  ) {
    return this.socialService.respondToFriendRequest(user, requestId, dto);
  }

  @Get('follows')
  getFollows(@CurrentUserDecorator() user: CurrentUser) {
    return this.socialService.getFollows(user);
  }

  @Post('follows/:targetUserId')
  followUser(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.socialService.followUser(user, targetUserId);
  }

  @Delete('follows/:targetUserId')
  unfollowUser(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.socialService.unfollowUser(user, targetUserId);
  }

  @Get('blocks')
  getBlocks(@CurrentUserDecorator() user: CurrentUser) {
    return this.socialService.getBlocks(user);
  }

  @Post('blocks/:targetUserId')
  blockUser(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.socialService.blockUser(user, targetUserId);
  }

  @Delete('blocks/:targetUserId')
  unblockUser(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.socialService.unblockUser(user, targetUserId);
  }

  @Get('social/users/:targetUserId/state')
  getRelationshipState(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.socialService.getRelationshipState(user, targetUserId);
  }
}
