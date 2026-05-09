export interface ChatUserContext {
  userId?: string;
  id?: string;
  schoolId: string;
  departmentId?: string | null;
  roles: string[];
}
