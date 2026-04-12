import { Injectable } from '@nestjs/common';

import { ApplyActionDto } from './dto/apply-action.dto';
import { AssignCaseDto } from './dto/assign-case.dto';
import { CloseCaseDto } from './dto/close-case.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsDto } from './dto/list-reports.dto';
import { ModerationActionPayload } from './interfaces/moderation-action.interface';

@Injectable()
export class ModerationRepository {
  async createReport(
    schoolId: string,
    reporterId: string,
    dto: CreateReportDto,
  ): Promise<Record<string, unknown>> {
    void schoolId;
    void reporterId;
    void dto;
    // TODO: Insert report row under tenant scope.
    return {};
  }

  async findReports(
    schoolId: string,
    query: ListReportsDto,
  ): Promise<unknown[]> {
    void schoolId;
    void query;
    // TODO: Return moderation reports filtered by type, status, and newest-first order.
    return [];
  }

  async findReportById(
    schoolId: string,
    reportId: string,
  ): Promise<{
    id: string;
    schoolId: string;
    reporterId: string;
    status: string;
  } | null> {
    void schoolId;
    void reportId;
    // TODO: Load single report with associated case linkage.
    return null;
  }

  async createModerationCase(
    schoolId: string,
    createdBy: string,
    dto: CreateCaseDto,
  ): Promise<Record<string, unknown>> {
    void schoolId;
    void createdBy;
    void dto;
    // TODO: Create case and attach selected reports transactionally.
    return {};
  }

  async findCases(schoolId: string): Promise<unknown[]> {
    void schoolId;
    // TODO: Return moderation cases scoped to the tenant.
    return [];
  }

  async findCaseById(
    schoolId: string,
    caseId: string,
  ): Promise<{
    id: string;
    schoolId: string;
    status: string;
  } | null> {
    void schoolId;
    void caseId;
    // TODO: Load moderation case with linked reports and actions.
    return null;
  }

  async assignCase(
    schoolId: string,
    caseId: string,
    actorUserId: string,
    dto: AssignCaseDto,
  ): Promise<Record<string, unknown>> {
    void schoolId;
    void caseId;
    void actorUserId;
    void dto;
    // TODO: Assign moderator and transition case status if needed.
    return {};
  }

  async closeCase(
    schoolId: string,
    caseId: string,
    actorUserId: string,
    dto: CloseCaseDto,
  ): Promise<Record<string, unknown>> {
    void schoolId;
    void caseId;
    void actorUserId;
    void dto;
    // TODO: Mark case closed or dismissed with moderator metadata.
    return {};
  }

  async createModerationAction(
    schoolId: string,
    moderatorId: string,
    payload: ModerationActionPayload,
  ): Promise<Record<string, unknown>> {
    void schoolId;
    void moderatorId;
    void payload;
    // TODO: Persist moderation action and link action_taken state to the case.
    return {};
  }
}
