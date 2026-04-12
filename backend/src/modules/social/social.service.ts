import { Injectable } from '@nestjs/common';

import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { SocialRepository } from './social.repository';

@Injectable()
export class SocialService {
  constructor(private readonly socialRepository: SocialRepository) {}

  async getFriends(): Promise<void> {
    void this.socialRepository;
  }

  async createFriendRequest(_dto: CreateFriendRequestDto): Promise<void> {
    void this.socialRepository;
  }

  async getFollows(): Promise<void> {
    void this.socialRepository;
  }

  async getBlocks(): Promise<void> {
    void this.socialRepository;
  }
}
