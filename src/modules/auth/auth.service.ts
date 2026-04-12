import { Injectable } from '@nestjs/common';

import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async register(_dto: RegisterDto): Promise<void> {
    void this.authRepository;
  }

  async login(_dto: LoginDto): Promise<void> {
    void this.authRepository;
  }

  async refresh(_dto: RefreshTokenDto): Promise<void> {
    void this.authRepository;
  }

  async getCurrentUser(): Promise<void> {
    void this.authRepository;
  }
}
