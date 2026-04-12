export class CreateGroupDto {
  name!: string;
  description?: string;
  visibility!: 'public' | 'private';
}
