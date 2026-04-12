import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUser {
  id: string;
  sessionId: string;
  schoolId: string;
  departmentId?: string | null;
  email: string;
  username?: string | null;
  role: string;
  roles: string[];
}

export const CurrentUserDecorator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: CurrentUser }>();
    return request.user;
  },
);
