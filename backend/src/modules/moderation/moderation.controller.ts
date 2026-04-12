import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserDecorator } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { ApplyActionDto } from './dto/apply-action.dto';
import { AssignCaseDto } from './dto/assign-case.dto';
import { CloseCaseDto } from './dto/close-case.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsDto } from './dto/list-reports.dto';
import { ModerationService } from './moderation.service';

interface ModerationUserContext {
  id: string;
  schoolId: string;
  roles: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('reports')
  createReport(
    @CurrentUserDecorator() user: ModerationUserContext,
    @Body() dto: CreateReportDto,
  ) {
    return this.moderationService.createReport(user, dto);
  }

  @Get('reports')
  listReports(
    @CurrentUserDecorator() user: ModerationUserContext,
    @Query() query: ListReportsDto,
  ) {
    return this.moderationService.listReports(user, query);
  }

  @Get('reports/:id')
  getReportById(
    @CurrentUserDecorator() user: ModerationUserContext,
    @Param('id') reportId: string,
  ) {
    return this.moderationService.getReportById(user, reportId);
  }

  @Post('cases')
  createCase(
    @CurrentUserDecorator() user: ModerationUserContext,
    @Body() dto: CreateCaseDto,
  ) {
    return this.moderationService.createCase(user, dto);
  }

  @Get('cases')
  listCases(@CurrentUserDecorator() user: ModerationUserContext) {
    return this.moderationService.listCases(user);
  }

  @Get('cases/:id')
  getCaseById(
    @CurrentUserDecorator() user: ModerationUserContext,
    @Param('id') caseId: string,
  ) {
    return this.moderationService.getCaseById(user, caseId);
  }

  @Patch('cases/:id/assign')
  assignCase(
    @CurrentUserDecorator() user: ModerationUserContext,
    @Param('id') caseId: string,
    @Body() dto: AssignCaseDto,
  ) {
    return this.moderationService.assignCase(user, caseId, dto);
  }

  @Patch('cases/:id/close')
  closeCase(
    @CurrentUserDecorator() user: ModerationUserContext,
    @Param('id') caseId: string,
    @Body() dto: CloseCaseDto,
  ) {
    return this.moderationService.closeCase(user, caseId, dto);
  }

  @Post('actions')
  applyAction(
    @CurrentUserDecorator() user: ModerationUserContext,
    @Body() dto: ApplyActionDto,
  ) {
    return this.moderationService.applyAction(user, dto);
  }
}
