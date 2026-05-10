import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ApplyActionDto } from './dto/apply-action.dto';
import { AssignCaseDto } from './dto/assign-case.dto';
import { CloseCaseDto } from './dto/close-case.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsDto } from './dto/list-reports.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { ModerationActionPayload } from './interfaces/moderation-action.interface';
import { ModerationRepository } from './moderation.repository';
import { ModerationAccessPolicy } from './policies/moderation-access.policy';
import { ModeratorRolePolicy } from './policies/moderator-role.policy';

interface ModerationUserContext {
  id: string;
  schoolId: string;
  roles: string[];
}

@Injectable()
export class ModerationService {
  constructor(
    private readonly moderationRepository: ModerationRepository,
    private readonly moderationAccessPolicy: ModerationAccessPolicy,
    private readonly moderatorRolePolicy: ModeratorRolePolicy,
  ) {}

  async createReport(
    user: ModerationUserContext,
    dto: CreateReportDto,
  ) {
    if (dto.referenceType === 'user') {
      throw new BadRequestException(
        'User reports are not supported in the current MVP schema',
      );
    }

    return this.moderationRepository.createReport(user.schoolId, user.id, dto);
  }

  async listReports(
    user: ModerationUserContext,
    query: ListReportsDto,
  ) {
    this.moderatorRolePolicy.assertModerator(user.roles);
    return this.moderationRepository.findReports(user.schoolId, query);
  }

  async getReportById(
    user: ModerationUserContext,
    reportId: string,
  ) {
    const report = await this.moderationRepository.findReportById(
      user.schoolId,
      reportId,
    );

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (!this.moderatorRolePolicy.isModerator(user.roles) && report.reporterId !== user.id) {
      throw new ForbiddenException('Report access denied');
    }

    this.moderationAccessPolicy.assertSameSchool(user.schoolId, report.schoolId);
    return report;
  }

  async reviewReport(
    user: ModerationUserContext,
    reportId: string,
    dto: ReviewReportDto,
  ) {
    this.moderatorRolePolicy.assertModerator(user.roles);
    const reviewed = await this.moderationRepository.reviewReport(
      user.schoolId,
      reportId,
      user.id,
      dto,
    );

    if (!reviewed) {
      throw new NotFoundException('Report not found');
    }

    return reviewed;
  }

  async createCase(
    user: ModerationUserContext,
    dto: CreateCaseDto,
  ) {
    this.moderatorRolePolicy.assertModerator(user.roles);
    return this.moderationRepository.createModerationCase(
      user.schoolId,
      user.id,
      dto,
    );
  }

  async listCases(user: ModerationUserContext) {
    this.moderatorRolePolicy.assertModerator(user.roles);
    return this.moderationRepository.findCases(user.schoolId);
  }

  async getCaseById(
    user: ModerationUserContext,
    caseId: string,
  ) {
    this.moderatorRolePolicy.assertModerator(user.roles);
    const moderationCase = await this.moderationRepository.findCaseById(
      user.schoolId,
      caseId,
    );

    if (!moderationCase) {
      throw new NotFoundException('Moderation case not found');
    }

    return moderationCase;
  }

  async assignCase(
    user: ModerationUserContext,
    caseId: string,
    dto: AssignCaseDto,
  ) {
    this.moderatorRolePolicy.assertModerator(user.roles);
    await this.getCaseById(user, caseId);

    return this.moderationRepository.assignCase(
      user.schoolId,
      caseId,
      user.id,
      dto,
    );
  }

  async closeCase(
    user: ModerationUserContext,
    caseId: string,
    dto: CloseCaseDto,
  ) {
    this.moderatorRolePolicy.assertModerator(user.roles);
    await this.getCaseById(user, caseId);

    return this.moderationRepository.closeCase(
      user.schoolId,
      caseId,
      user.id,
      dto,
    );
  }

  async applyAction(
    user: ModerationUserContext,
    dto: ApplyActionDto,
  ) {
    this.moderatorRolePolicy.assertModerator(user.roles);
    await this.getCaseById(user, dto.caseId);

    const payload: ModerationActionPayload = {
      caseId: dto.caseId,
      targetUserId: dto.targetUserId,
      actionType: dto.actionType,
      reason: dto.reason,
      durationSeconds: dto.durationSeconds,
      metadata: dto.metadata,
    };

    // TODO: Integrate with Audit module after persistence succeeds.
    return this.moderationRepository.createModerationAction(
      user.schoolId,
      user.id,
      payload,
    );
  }
}
