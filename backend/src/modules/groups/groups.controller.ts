import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUserDecorator, CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService } from './groups.service';

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  findAll(@CurrentUserDecorator() user: CurrentUser) {
    return this.groupsService.findAll(user);
  }

  @Get(':groupId')
  findById(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('groupId') groupId: string,
  ) {
    return this.groupsService.findById(user, groupId);
  }

  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupsService.create(user, dto);
  }
}
