import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserDecorator, CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUserDecorator() user: CurrentUser) {
    return this.usersService.getCurrentProfile(user.id, user.schoolId);
  }

  @Get('search')
  search(
    @CurrentUserDecorator() user: CurrentUser,
    @Query('q') query?: string,
  ) {
    return this.usersService.search(user.schoolId, query ?? '');
  }

  @Get(':userId/presence')
  getPresence(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('userId') userId: string,
  ) {
    return this.usersService.getPresence(user.schoolId, userId);
  }

  @Get(':userId')
  getById(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('userId') userId: string,
  ) {
    return this.usersService.getById(user.schoolId, userId);
  }

  @Patch('me')
  updateMe(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateMe(user.id, user.schoolId, dto);
  }
}
