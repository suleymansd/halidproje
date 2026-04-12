export interface ChatUserContext {
  userId: string;
  schoolId: string;
  departmentId?: string | null;
  roles: string[];
}
