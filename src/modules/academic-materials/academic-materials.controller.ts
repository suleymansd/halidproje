import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserDecorator } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { BookmarkMaterialDto } from './dto/bookmark-material.dto';
import { CommentMaterialDto } from './dto/comment-material.dto';
import { ListMaterialsDto } from './dto/list-materials.dto';
import { ReportMaterialDto } from './dto/report-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UploadMaterialDto } from './dto/upload-material.dto';
import { VoteMaterialDto } from './dto/vote-material.dto';
import { AcademicMaterialsService } from './academic-materials.service';

interface AcademicMaterialUserContext {
  id: string;
  schoolId: string;
  roles: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('materials')
export class AcademicMaterialsController {
  constructor(
    private readonly academicMaterialsService: AcademicMaterialsService,
  ) {}

  @Get()
  listMaterials(
    @CurrentUserDecorator() user: AcademicMaterialUserContext,
    @Query() query: ListMaterialsDto,
  ) {
    return this.academicMaterialsService.listMaterials(user, query);
  }

  @Get(':id')
  getMaterialById(
    @CurrentUserDecorator() user: AcademicMaterialUserContext,
    @Param('id') id: string,
  ) {
    return this.academicMaterialsService.getMaterialById(user, id);
  }

  @Post()
  uploadMaterial(
    @CurrentUserDecorator() user: AcademicMaterialUserContext,
    @Body() dto: UploadMaterialDto,
  ) {
    return this.academicMaterialsService.uploadMaterial(user, dto);
  }

  @Patch(':id')
  updateMaterial(
    @CurrentUserDecorator() user: AcademicMaterialUserContext,
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.academicMaterialsService.updateMaterial(user, id, dto);
  }

  @Delete(':id')
  deleteMaterial(
    @CurrentUserDecorator() user: AcademicMaterialUserContext,
    @Param('id') id: string,
  ) {
    return this.academicMaterialsService.deleteMaterial(user, id);
  }

  @Get(':id/comments')
  listMaterialComments(
    @CurrentUserDecorator() user: AcademicMaterialUserContext,
    @Param('id') id: string,
  ) {
    return this.academicMaterialsService.listMaterialComments(user, id);
  }

  @Post(':id/comments')
  commentMaterial(
    @CurrentUserDecorator() user: AcademicMaterialUserContext,
    @Param('id') id: string,
    @Body() dto: CommentMaterialDto,
  ) {
    return this.academicMaterialsService.commentMaterial(user, id, dto);
  }

  @Post(':id/vote')
  voteMaterial(
    @CurrentUserDecorator() user: AcademicMaterialUserContext,
    @Param('id') id: string,
    @Body() dto: VoteMaterialDto,
  ) {
    return this.academicMaterialsService.voteMaterial(user, id, dto);
  }

  @Delete(':id/vote')
  removeVote(
    @CurrentUserDecorator() user: AcademicMaterialUserContext,
    @Param('id') id: string,
  ) {
    return this.academicMaterialsService.removeVote(user, id);
  }

  @Post(':id/bookmark')
  bookmarkMaterial(
    @CurrentUserDecorator() user: AcademicMaterialUserContext,
    @Param('id') id: string,
    @Body() dto: BookmarkMaterialDto,
  ) {
    return this.academicMaterialsService.bookmarkMaterial(user, id, dto);
  }

  @Delete(':id/bookmark')
  removeBookmark(
    @CurrentUserDecorator() user: AcademicMaterialUserContext,
    @Param('id') id: string,
  ) {
    return this.academicMaterialsService.removeBookmark(user, id);
  }

  @Post(':id/report')
  reportMaterial(
    @CurrentUserDecorator() user: AcademicMaterialUserContext,
    @Param('id') id: string,
    @Body() dto: ReportMaterialDto,
  ) {
    return this.academicMaterialsService.reportMaterial(user, id, dto);
  }
}
