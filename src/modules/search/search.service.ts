import { Injectable } from '@nestjs/common';

import { SearchGroupsDto } from './dto/search-groups.dto';
import { SearchMaterialsDto } from './dto/search-materials.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { SearchEntityTypes } from './constants/search-entity-types.constant';
import { SearchRepository } from './search.repository';

interface SearchUserContext {
  id: string;
  schoolId: string;
  roles: string[];
}

@Injectable()
export class SearchService {
  constructor(private readonly searchRepository: SearchRepository) {}

  async search(user: SearchUserContext, query: SearchQueryDto) {
    switch (query.entityType) {
      case SearchEntityTypes.Material:
        return this.searchMaterials(user, query);
      case SearchEntityTypes.User:
        return this.searchUsers(user, query);
      case SearchEntityTypes.Group:
        return this.searchGroups(user, query);
      default:
        return this.searchRepository.searchAll(user.schoolId, query);
    }
  }

  async searchMaterials(user: SearchUserContext, query: SearchMaterialsDto) {
    return this.searchRepository.searchMaterials(user.schoolId, query);
  }

  async searchUsers(user: SearchUserContext, query: SearchUsersDto) {
    return this.searchRepository.searchUsers(user.schoolId, query);
  }

  async searchGroups(user: SearchUserContext, query: SearchGroupsDto) {
    return this.searchRepository.searchGroups(user.schoolId, query);
  }
}
