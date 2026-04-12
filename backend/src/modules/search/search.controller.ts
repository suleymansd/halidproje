import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentUserDecorator } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { SearchGroupsDto } from './dto/search-groups.dto';
import { SearchMaterialsDto } from './dto/search-materials.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { SearchService } from './search.service';

interface SearchUserContext {
  id: string;
  schoolId: string;
  roles: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @CurrentUserDecorator() user: SearchUserContext,
    @Query() query: SearchQueryDto,
  ) {
    return this.searchService.search(user, query);
  }

  @Get('materials')
  searchMaterials(
    @CurrentUserDecorator() user: SearchUserContext,
    @Query() query: SearchMaterialsDto,
  ) {
    return this.searchService.searchMaterials(user, query);
  }

  @Get('users')
  searchUsers(
    @CurrentUserDecorator() user: SearchUserContext,
    @Query() query: SearchUsersDto,
  ) {
    return this.searchService.searchUsers(user, query);
  }

  @Get('groups')
  searchGroups(
    @CurrentUserDecorator() user: SearchUserContext,
    @Query() query: SearchGroupsDto,
  ) {
    return this.searchService.searchGroups(user, query);
  }
}
