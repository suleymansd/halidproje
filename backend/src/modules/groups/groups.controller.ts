import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  findAll(): Promise<void> {
    return this.groupsService.findAll();
  }

  @Get(':groupId')
  findById(@Param('groupId') groupId: string): Promise<void> {
    return this.groupsService.findById(groupId);
  }

  @Post()
  create(@Body() dto: CreateGroupDto): Promise<void> {
    return this.groupsService.create(dto);
  }
}
