import { Injectable } from '@nestjs/common';

import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsRepository } from './groups.repository';

@Injectable()
export class GroupsService {
  constructor(private readonly groupsRepository: GroupsRepository) {}

  async findAll(): Promise<void> {
    void this.groupsRepository;
  }

  async findById(_groupId: string): Promise<void> {
    void this.groupsRepository;
  }

  async create(_dto: CreateGroupDto): Promise<void> {
    void this.groupsRepository;
  }
}
