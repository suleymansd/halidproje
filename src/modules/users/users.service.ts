import { Injectable } from '@nestjs/common';

import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getMe(): Promise<void> {
    void this.usersRepository;
  }

  async search(): Promise<void> {
    void this.usersRepository;
  }

  async getById(_userId: string): Promise<void> {
    void this.usersRepository;
  }

  async updateMe(_dto: UpdateUserDto): Promise<void> {
    void this.usersRepository;
  }
}
