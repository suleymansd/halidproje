import { Body, Controller, Get, Param, Patch } from '@nestjs/common';

import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(): Promise<void> {
    return this.usersService.getMe();
  }

  @Get('search')
  search(): Promise<void> {
    return this.usersService.search();
  }

  @Get(':userId')
  getById(@Param('userId') userId: string): Promise<void> {
    return this.usersService.getById(userId);
  }

  @Patch('me')
  updateMe(@Body() dto: UpdateUserDto): Promise<void> {
    return this.usersService.updateMe(dto);
  }
}
