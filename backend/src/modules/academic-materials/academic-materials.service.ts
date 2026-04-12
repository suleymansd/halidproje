import {
  BadRequestException,
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
  departmentId?: string | null;
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
    return this.academicMaterialsRepository.findMaterials(user.schoolId, query, user.id);
  }

  async getMaterialById(user: AcademicMaterialUserContext, materialId: string) {
    const material = await this.academicMaterialsRepository.findMaterialById(
      user.schoolId,
      materialId,
      user.id,
    );

    if (!material) {
      throw new NotFoundException('Material not found');
    }

    this.materialAccessPolicy.assertSameSchool(user.schoolId, material.schoolId);
    if (material.deletedAt && !this.materialModerationPolicy.isModerator(user.roles)) {
      throw new NotFoundException('Material not found');
    }

    return material;
  }

  async uploadMaterial(
    user: AcademicMaterialUserContext,
    dto: UploadMaterialDto,
  ) {
    const normalizedTags = this.normalizeTags(dto.tags);

    if (dto.departmentId) {
      const department = await this.academicMaterialsRepository.findDepartmentById(
        user.schoolId,
        dto.departmentId,
      );

      if (!department) {
        throw new BadRequestException('departmentId must belong to the current school');
      }
    }

    if (dto.courseId) {
      const course = await this.academicMaterialsRepository.findCourseById(
        user.schoolId,
        dto.courseId,
      );

      if (!course) {
        throw new BadRequestException('courseId must belong to the current school');
      }

      if (dto.departmentId && course.departmentId !== dto.departmentId) {
        throw new BadRequestException('courseId must belong to the selected department');
      }
    }

    return this.academicMaterialsRepository.createMaterial(user.schoolId, user.id, {
      ...dto,
      tags: normalizedTags,
    });
  }

  async updateMaterial(
    user: AcademicMaterialUserContext,
    materialId: string,
    dto: UpdateMaterialDto,
  ) {
    const material = await this.getMaterialById(user, materialId);
    this.materialAccessPolicy.assertOwnerOrModerator(user, material.uploaderId);

    if (material.deletedAt) {
      throw new BadRequestException('Deleted materials cannot be edited');
    }

    if (dto.departmentId) {
      const department = await this.academicMaterialsRepository.findDepartmentById(
        user.schoolId,
        dto.departmentId,
      );

      if (!department) {
        throw new BadRequestException('departmentId must belong to the current school');
      }
    }

    if (dto.courseId) {
      const course = await this.academicMaterialsRepository.findCourseById(
        user.schoolId,
        dto.courseId,
      );

      if (!course) {
        throw new BadRequestException('courseId must belong to the current school');
      }

      const departmentId = dto.departmentId ?? material.departmentId;
      if (departmentId && course.departmentId !== departmentId) {
        throw new BadRequestException('courseId must belong to the selected department');
      }
    }

    return this.academicMaterialsRepository.updateMaterial(
      user.schoolId,
      materialId,
      dto,
      user.id,
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
    const material = await this.getMaterialById(user, materialId);
    if (material.deletedAt) {
      throw new NotFoundException('Material not found');
    }

    if (dto.parentCommentId) {
      const parentComment = await this.academicMaterialsRepository.findMaterialCommentById(
        user.schoolId,
        materialId,
        dto.parentCommentId,
      );

      if (!parentComment) {
        throw new BadRequestException('parentCommentId must belong to the same material');
      }
    }

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
    const material = await this.getMaterialById(user, materialId);
    if (material.deletedAt) {
      throw new NotFoundException('Material not found');
    }

    return this.academicMaterialsRepository.upsertMaterialVote(
      user.schoolId,
      materialId,
      user.id,
      dto,
    );
  }

  async removeVote(user: AcademicMaterialUserContext, materialId: string) {
    await this.getMaterialById(user, materialId);
    await this.academicMaterialsRepository.deleteMaterialVote(
      user.schoolId,
      materialId,
      user.id,
    );

    return { removed: true };
  }

  async bookmarkMaterial(
    user: AcademicMaterialUserContext,
    materialId: string,
    dto: BookmarkMaterialDto,
  ) {
    const material = await this.getMaterialById(user, materialId);
    if (material.deletedAt) {
      throw new NotFoundException('Material not found');
    }

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
    await this.academicMaterialsRepository.deleteMaterialBookmark(
      user.schoolId,
      materialId,
      user.id,
    );

    return { removed: true };
  }

  async reportMaterial(
    user: AcademicMaterialUserContext,
    materialId: string,
    dto: ReportMaterialDto,
  ) {
    const material = await this.getMaterialById(user, materialId);
    if (material.deletedAt) {
      throw new NotFoundException('Material not found');
    }

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

  private normalizeTags(tags: string[]): string[] {
    const normalized = tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .map((tag) => tag.slice(0, 60));

    return [...new Set(normalized)];
  }
}
