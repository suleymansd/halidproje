import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AppLoggerService } from '../../infrastructure/logging/logger.service';
import { CompleteOnboardingDto } from '../auth/dto/complete-onboarding.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfile } from './interfaces/user-profile.interface';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly logger: AppLoggerService,
  ) {}

  async getCurrentProfile(userId: string, schoolId: string): Promise<UserProfile> {
    const profile = await this.usersRepository.findProfileById(userId, schoolId);
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    return profile;
  }

  async getMe(): Promise<void> {
    throw new NotFoundException('Use the authenticated profile endpoint');
  }

  async search(schoolId: string, query: string) {
    return this.usersRepository.searchBySchool(schoolId, query);
  }

  async getById(schoolId: string, userId: string) {
    const profile = await this.usersRepository.findProfileById(userId, schoolId);
    if (!profile) {
      throw new NotFoundException('User not found');
    }

    return profile;
  }

  async updateMe(userId: string, schoolId: string, dto: UpdateUserDto) {
    const normalizedDepartmentId = dto.department_id ?? dto.departmentId;
    const normalizedUsername = dto.username;

    if (normalizedDepartmentId) {
      const department = await this.usersRepository.findDepartmentByIdAndSchool(
        normalizedDepartmentId,
        schoolId,
      );

      if (!department) {
        throw new NotFoundException('Department not found in your school');
      }
    }

    if (normalizedUsername) {
      const usernameTaken = await this.usersRepository.findByUsername(normalizedUsername);
      if (usernameTaken && usernameTaken.id !== userId) {
        throw new ConflictException('Username is already in use');
      }
    }

    await this.usersRepository.updateUser(userId, schoolId, dto);
    this.logger.log(`User updated onboarding/profile: ${userId}`, UsersService.name);
    return this.getCurrentProfile(userId, schoolId);
  }

  async completeOnboarding(
    userId: string,
    schoolId: string,
    dto: CompleteOnboardingDto,
  ): Promise<void> {
    const normalizedSchoolId = dto.school_id ?? dto.schoolId ?? schoolId;
    const normalizedDepartmentId = dto.department_id ?? dto.departmentId ?? '';
    const normalizedUsername = dto.username;

    if (normalizedDepartmentId) {
      const department = await this.usersRepository.findDepartmentByIdAndSchool(
        normalizedDepartmentId,
        normalizedSchoolId,
      );

      if (!department) {
        throw new NotFoundException('Department not found in the selected school');
      }
    }

    if (normalizedUsername) {
      const usernameTaken = await this.usersRepository.findByUsername(normalizedUsername);
      if (usernameTaken && usernameTaken.id !== userId) {
        throw new ConflictException('Username is already in use');
      }
    }

    await this.usersRepository.completeOnboarding(userId, schoolId, dto);
  }
}
