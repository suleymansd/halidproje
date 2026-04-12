import { IsIn, IsInt } from 'class-validator';

export class VoteMaterialDto {
  @IsInt()
  @IsIn([1, -1])
  vote!: 1 | -1;
}
