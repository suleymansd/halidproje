import { IsIn, IsOptional } from 'class-validator';

import { SearchQueryDto } from './search-query.dto';

export class SearchMaterialsDto extends SearchQueryDto {
  @IsOptional()
  @IsIn(['newest', 'most_upvoted'])
  sortBy?: 'newest' | 'most_upvoted';
}
