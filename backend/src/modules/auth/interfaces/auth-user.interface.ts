export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  schoolId: string;
  departmentId: string | null;
  username: string | null;
  role: string;
}
