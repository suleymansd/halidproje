import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsRepository } from './groups.repository';

@Injectable()
export class GroupsService {
  constructor(private readonly groupsRepository: GroupsRepository) {}

  async findAll(user: CurrentUser) {
    this.assertUser(user);
    return this.groupsRepository.findAll(user.schoolId);
  }

  async findById(user: CurrentUser, groupId: string) {
    this.assertUser(user);
    const group = await this.groupsRepository.findById(user.schoolId, groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async create(user: CurrentUser, dto: CreateGroupDto) {
    this.assertUser(user);
    return this.groupsRepository.create(user.schoolId, user.id, dto);
  }

  private assertUser(user: CurrentUser) {
    if (!user?.id || !user?.schoolId) {
      throw new UnauthorizedException('Authentication required');
    }
  }
}
