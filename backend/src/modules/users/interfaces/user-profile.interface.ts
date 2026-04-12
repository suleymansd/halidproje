export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  username: string | null;
  bio: string | null;
  role: string;
  schoolId: string;
  departmentId: string | null;
  onboardingCompleted: boolean;
  school: {
    id: string;
    name: string;
  };
  department: {
    id: string;
    name: string;
  } | null;
}
