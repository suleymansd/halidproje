export class UserEntity {
  id!: string;
  schoolId!: string;
  departmentId!: string | null;
  email!: string;
  username!: string | null;
  fullName!: string;
  bio!: string | null;
  role!: string;
  onboardingCompleted!: boolean;
}
