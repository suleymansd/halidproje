import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID, createHash } from 'crypto';

import { AppLoggerService } from '../../infrastructure/logging/logger.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthRepository } from './auth.repository';
import { AuthUser } from './interfaces/auth-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly logger: AppLoggerService,
  ) {}

  async register(dto: RegisterDto) {
    const input = this.normalizeRegistration(dto);
    const email = input.email.trim().toLowerCase();
    this.assertUniversityEmail(email);
    const existingUser = await this.authRepository.findUserByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const schoolId = await this.resolveRegistrationSchoolId(input.schoolId);
    await this.ensureSchoolAndDepartment(schoolId, input.departmentId);

    if (input.username) {
      const usernameTaken = await this.authRepository.findUserByUsername(input.username);
      if (usernameTaken) {
        throw new ConflictException('Username is already in use');
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.authRepository.createUser({
      email,
      fullName: input.fullName,
      passwordHash,
      schoolId,
      departmentId: input.departmentId,
      username: input.username,
      onboardingCompleted: false,
      role: 'student',
    });
    await this.authRepository.addUserToDefaultRooms(
      user.id,
      schoolId,
      input.departmentId,
    );

    this.logger.log(`User registered: ${user.id}`, AuthService.name);

    return this.createAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.authRepository.findUserWithPasswordByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const session = await this.authRepository.findSessionById(payload.sid);

    if (!session || session.userId !== payload.sub || session.revokedAt) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const providedTokenHash = this.hashToken(dto.refreshToken);
    if (providedTokenHash !== session.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await this.authRepository.revokeSession(session.id);
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.authRepository.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found for refresh token');
    }

    return this.issueTokens(user, session.id);
  }

  async logout(user: CurrentUser) {
    await this.authRepository.revokeSession(user.sessionId);
    return {
      success: true,
    };
  }

  async getCurrentUser(user: CurrentUser) {
    return this.usersService.getCurrentProfile(user.id, user.schoolId);
  }

  async completeOnboarding(user: CurrentUser, dto: CompleteOnboardingDto) {
    const input = this.normalizeOnboarding(dto);
    await this.ensureSchoolAndDepartment(input.schoolId ?? user.schoolId, input.departmentId);

    if (input.username) {
      const usernameTaken = await this.authRepository.findUserByUsername(input.username);
      if (usernameTaken && usernameTaken.id !== user.id) {
        throw new ConflictException('Username is already in use');
      }
    }

    await this.usersService.completeOnboarding(user.id, user.schoolId, dto);
    return this.usersService.getCurrentProfile(user.id, input.schoolId ?? user.schoolId);
  }

  private normalizeRegistration(dto: RegisterDto) {
    return {
      fullName: dto.full_name ?? dto.fullName ?? '',
      email: dto.email,
      password: dto.password,
      schoolId: dto.school_id ?? dto.schoolId ?? '',
      departmentId: dto.department_id ?? dto.departmentId ?? '',
      username: dto.username?.trim().toLowerCase() ?? null,
    };
  }

  private normalizeOnboarding(dto: CompleteOnboardingDto) {
    return {
      fullName: dto.full_name ?? dto.fullName,
      schoolId: dto.school_id ?? dto.schoolId,
      departmentId: dto.department_id ?? dto.departmentId ?? '',
      username: dto.username,
    };
  }

  private async createAuthResponse(user: AuthUser) {
    const sessionId = randomUUID();
    return this.issueTokens(user, sessionId, true);
  }

  private async issueTokens(user: AuthUser, sessionId: string, isNewSession = false) {
    const accessPayload: JwtPayload = {
      sub: user.id,
      sid: sessionId,
      jti: randomUUID(),
      schoolId: user.schoolId,
      departmentId: user.departmentId ?? null,
      email: user.email,
      username: user.username ?? null,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    });

    const refreshToken = await this.jwtService.signAsync(accessPayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    });

    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshExpiresAt = this.resolveExpiryDate(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d');

    if (isNewSession) {
      await this.authRepository.createSession({
        id: sessionId,
        userId: user.id,
        schoolId: user.schoolId,
        refreshTokenHash,
        expiresAt: refreshExpiresAt,
      });
    } else {
      await this.authRepository.rotateSessionRefreshToken(sessionId, refreshTokenHash, refreshExpiresAt);
    }

    return {
      accessToken,
      refreshToken,
      user: this.toUserSummary(user),
    };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid');
    }
  }

  private async ensureSchoolAndDepartment(schoolId: string, departmentId: string) {
    const school = await this.authRepository.findSchoolById(schoolId);
    if (!school) {
      throw new UnauthorizedException('Selected school is invalid');
    }

    const department = await this.authRepository.findDepartmentByIdAndSchool(
      departmentId,
      schoolId,
    );

    if (!department) {
      throw new UnauthorizedException('Department does not belong to the selected school');
    }
  }

  private async resolveRegistrationSchoolId(schoolId?: string): Promise<string> {
    if (schoolId?.trim()) {
      return schoolId.trim();
    }

    const defaultSchool = await this.authRepository.findDefaultSchool();
    if (!defaultSchool) {
      throw new BadRequestException('Default school is not configured');
    }

    return defaultSchool.id;
  }

  private assertUniversityEmail(email: string): void {
    if (!email.endsWith('@isu.edu.tr')) {
      throw new BadRequestException('Email must use the @isu.edu.tr domain');
    }
  }

  private resolveExpiryDate(duration: string): Date {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    return new Date(Date.now() + value * multipliers[unit]);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toUserSummary(user: AuthUser) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      schoolId: user.schoolId,
      departmentId: user.departmentId,
      username: user.username,
      role: user.role,
    };
  }
}
