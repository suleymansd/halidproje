import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { BookmarkMaterialDto } from './dto/bookmark-material.dto';
import { CommentMaterialDto } from './dto/comment-material.dto';
import { ListMaterialsDto } from './dto/list-materials.dto';
import { ReportMaterialDto } from './dto/report-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UploadMaterialDto } from './dto/upload-material.dto';
import { VoteMaterialDto } from './dto/vote-material.dto';
import { AcademicMaterialsRepository } from './academic-materials.repository';
import { MaterialAccessPolicy } from './policies/material-access.policy';
import { MaterialModerationPolicy } from './policies/material-moderation.policy';

interface AcademicMaterialUserContext {
  id: string;
  schoolId: string;
  roles: string[];
}

@Injectable()
export class AcademicMaterialsService {
  constructor(
    private readonly academicMaterialsRepository: AcademicMaterialsRepository,
    private readonly materialAccessPolicy: MaterialAccessPolicy,
    private readonly materialModerationPolicy: MaterialModerationPolicy,
  ) {}

  async listMaterials(
    user: AcademicMaterialUserContext,
    query: ListMaterialsDto,
  ) {
    return this.academicMaterialsRepository.findMaterials(user.schoolId, query);
  }

  async getMaterialById(user: AcademicMaterialUserContext, materialId: string) {
    const material = await this.academicMaterialsRepository.findMaterialById(
      user.schoolId,
      materialId,
    );

    if (!material) {
      throw new NotFoundException('Material not found');
    }

    this.materialAccessPolicy.assertSameSchool(user.schoolId, material.schoolId);
    return material;
  }

  async uploadMaterial(
    user: AcademicMaterialUserContext,
    dto: UploadMaterialDto,
  ) {
    // TODO: Validate referenced course and department in the same tenant.
    return this.academicMaterialsRepository.createMaterial(user.schoolId, user.id, dto);
  }

  async updateMaterial(
    user: AcademicMaterialUserContext,
    materialId: string,
    dto: UpdateMaterialDto,
  ) {
    const material = await this.getMaterialById(user, materialId);
    this.materialAccessPolicy.assertOwnerOrModerator(user, material.uploaderId);

    return this.academicMaterialsRepository.updateMaterial(
      user.schoolId,
      materialId,
      dto,
    );
  }

  async deleteMaterial(user: AcademicMaterialUserContext, materialId: string) {
    const material = await this.getMaterialById(user, materialId);
    this.materialModerationPolicy.assertCanRemoveMaterial(user, material.uploaderId);

    return this.academicMaterialsRepository.softDeleteMaterial(
      user.schoolId,
      materialId,
      user.id,
    );
  }

  async listMaterialComments(
    user: AcademicMaterialUserContext,
    materialId: string,
  ) {
    await this.getMaterialById(user, materialId);
    return this.academicMaterialsRepository.findMaterialComments(
      user.schoolId,
      materialId,
    );
  }

  async commentMaterial(
    user: AcademicMaterialUserContext,
    materialId: string,
    dto: CommentMaterialDto,
  ) {
    await this.getMaterialById(user, materialId);
    return this.academicMaterialsRepository.createMaterialComment(
      user.schoolId,
      materialId,
      user.id,
      dto,
    );
  }

  async voteMaterial(
    user: AcademicMaterialUserContext,
    materialId: string,
    dto: VoteMaterialDto,
  ) {
    await this.getMaterialById(user, materialId);
    return this.academicMaterialsRepository.upsertMaterialVote(
      user.schoolId,
      materialId,
      user.id,
      dto,
    );
  }

  async removeVote(user: AcademicMaterialUserContext, materialId: string) {
    await this.getMaterialById(user, materialId);
    return this.academicMaterialsRepository.deleteMaterialVote(
      user.schoolId,
      materialId,
      user.id,
    );
  }

  async bookmarkMaterial(
    user: AcademicMaterialUserContext,
    materialId: string,
    dto: BookmarkMaterialDto,
  ) {
    await this.getMaterialById(user, materialId);
    return this.academicMaterialsRepository.createMaterialBookmark(
      user.schoolId,
      materialId,
      user.id,
      dto,
    );
  }

  async removeBookmark(
    user: AcademicMaterialUserContext,
    materialId: string,
  ) {
    await this.getMaterialById(user, materialId);
    return this.academicMaterialsRepository.deleteMaterialBookmark(
      user.schoolId,
      materialId,
      user.id,
    );
  }

  async reportMaterial(
    user: AcademicMaterialUserContext,
    materialId: string,
    dto: ReportMaterialDto,
  ) {
    await this.getMaterialById(user, materialId);
    return this.academicMaterialsRepository.createMaterialReport(
      user.schoolId,
      materialId,
      user.id,
      dto,
    );
  }

  async resolveMaterialReport(
    user: AcademicMaterialUserContext,
    reportId: string,
  ) {
    if (!this.materialModerationPolicy.isModerator(user.roles)) {
      throw new ForbiddenException('Moderator role required');
    }

    return this.academicMaterialsRepository.resolveMaterialReport(
      user.schoolId,
      reportId,
      user.id,
    );
  }
}
