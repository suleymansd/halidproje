import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserDecorator, CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUserDecorator() user: CurrentUser) {
    return this.authService.logout(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrentUser(@CurrentUserDecorator() user: CurrentUser) {
    return this.authService.getCurrentUser(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('onboarding')
  completeOnboarding(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.authService.completeOnboarding(user, dto);
  }
}
