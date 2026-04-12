export interface JwtPayload {
  sub: string;
  sid: string;
  jti?: string;
  schoolId: string;
  departmentId: string | null;
  email: string;
  username: string | null;
  role: string;
}
