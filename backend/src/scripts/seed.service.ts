import * as bcrypt from 'bcryptjs';
import { Pool, QueryResult } from 'pg';

type SeedRole = 'super_admin' | 'school_admin' | 'moderator' | 'student';

interface SeedDepartment {
  code: string;
  name: string;
  description: string;
}

interface SeedUserDefinition {
  email: string;
  fullName: string;
  username: string;
  role: SeedRole;
  departmentCode: string;
}

interface SeedCourse {
  code: string;
  name: string;
  description: string;
}

interface RoleRow {
  id: string;
  name: string;
}

interface SchoolRow {
  id: string;
  name: string;
  slug: string;
}

interface DepartmentRow {
  id: string;
  school_id: string;
  code: string | null;
  name: string;
}

interface CourseRow {
  id: string;
  school_id: string;
  department_id: string | null;
  code: string;
  name: string;
}

interface UserRow {
  id: string;
  email: string;
  school_id: string;
  department_id: string | null;
  role: string;
}

interface GroupRow {
  id: string;
  school_id: string;
  name: string;
}

interface ChatRoomRow {
  id: string;
  room_type: 'general' | 'department' | 'group';
  department_id: string | null;
  group_id: string | null;
}

export class SeedService {
  private readonly defaultPassword =
    process.env.SEED_DEFAULT_PASSWORD ?? 'DevPassword123!';

  private readonly schoolSlug =
    process.env.SEED_SCHOOL_SLUG ?? 'isu-universitesi';

  private readonly schoolName =
    process.env.SEED_SCHOOL_NAME ?? 'İsü Üniversitesi';

  private readonly departments: SeedDepartment[] = [
    {
      code: 'SE',
      name: 'Software Engineering',
      description: 'Software systems, architecture, and product development.',
    },
    {
      code: 'CE',
      name: 'Computer Engineering',
      description: 'Computer systems, embedded systems, and infrastructure.',
    },
    {
      code: 'BIO',
      name: 'Biochemistry',
      description: 'Molecular science, laboratory work, and life sciences.',
    },
    {
      code: 'BUS',
      name: 'Business Administration',
      description: 'Business operations, finance, and strategy.',
    },
    {
      code: 'PSY',
      name: 'Psychology',
      description: 'Behavioral science, research, and applied psychology.',
    },
  ];

  private readonly users: SeedUserDefinition[] = [
    {
      email: 'admin@isu.local',
      fullName: 'İSÜ School Admin',
      username: 'isu_admin',
      role: 'school_admin',
      departmentCode: 'SE',
    },
    {
      email: 'moderator@isu.local',
      fullName: 'İSÜ Moderator',
      username: 'isu_moderator',
      role: 'moderator',
      departmentCode: 'CE',
    },
    {
      email: 'student.software@isu.local',
      fullName: 'Software Student',
      username: 'software_student',
      role: 'student',
      departmentCode: 'SE',
    },
    {
      email: 'student.computer@isu.local',
      fullName: 'Computer Student',
      username: 'computer_student',
      role: 'student',
      departmentCode: 'CE',
    },
    {
      email: 'student.biochemistry@isu.local',
      fullName: 'Biochemistry Student',
      username: 'biochemistry_student',
      role: 'student',
      departmentCode: 'BIO',
    },
  ];

  private readonly coursesByDepartmentCode: Record<string, SeedCourse[]> = {
    SE: [
      {
        code: 'SE101',
        name: 'Intro to Software',
        description: 'Introduction to software engineering fundamentals.',
      },
      {
        code: 'SE201',
        name: 'Data Structures',
        description: 'Core data structures and algorithmic problem solving.',
      },
    ],
    CE: [
      {
        code: 'CE101',
        name: 'Computer Systems',
        description: 'Computer architecture, systems, and low-level concepts.',
      },
    ],
    BIO: [
      {
        code: 'BIO101',
        name: 'Intro to Biochemistry',
        description: 'Foundational biochemistry concepts and molecular biology.',
      },
    ],
  };

  constructor(private readonly pool: Pool) {}

  async seed(): Promise<void> {
    await this.ensureRolesTable();
    await this.ensureRoles();

    const school = await this.ensureSchool();
    const departments = await this.ensureDepartments(school.id);
    await this.ensureCourses(school.id, departments);
    await this.ensureUsers(school.id, departments);

    const users = await this.findSchoolUsers(school.id);
    const generalRoom = await this.ensureGeneralRoom(
      school.id,
      this.findRoomOwner(users)?.id ?? null,
    );

    await this.ensureGeneralMemberships(generalRoom.id, school.id, users);
    await this.ensureDepartmentRoomsAndMemberships(school.id, departments, users);
    await this.ensureSampleGroupAndRoom(school.id, users, departments);
  }

  getSeedSummary(): { school: string; password: string; users: string[] } {
    return {
      school: this.schoolName,
      password: this.defaultPassword,
      users: this.users.map((user) => user.email),
    };
  }

  private async ensureRolesTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(50) NOT NULL UNIQUE,
        description text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  private async ensureRoles(): Promise<Map<string, RoleRow>> {
    const definitions: Array<{ name: SeedRole; description: string }> = [
      {
        name: 'super_admin',
        description: 'Platform-level super administrator for local development.',
      },
      {
        name: 'school_admin',
        description: 'Tenant-level school administrator for local development.',
      },
      {
        name: 'moderator',
        description: 'Moderator role for seeded moderation scenarios.',
      },
      {
        name: 'student',
        description: 'Default student role for seeded users.',
      },
    ];

    const roles = new Map<string, RoleRow>();

    for (const definition of definitions) {
      const result = await this.pool.query<RoleRow>(
        `
          INSERT INTO roles (name, description)
          VALUES ($1, $2)
          ON CONFLICT (name)
          DO UPDATE SET
            description = EXCLUDED.description,
            updated_at = now()
          RETURNING id, name
        `,
        [definition.name, definition.description],
      );

      roles.set(definition.name, result.rows[0]);
    }

    return roles;
  }

  private async ensureSchool(): Promise<SchoolRow> {
    const result = await this.pool.query<SchoolRow>(
      `
        INSERT INTO schools (name, slug)
        VALUES ($1, $2)
        ON CONFLICT (slug)
        DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = now()
        RETURNING id, name, slug
      `,
      [this.schoolName, this.schoolSlug],
    );

    return result.rows[0];
  }

  private async ensureDepartments(
    schoolId: string,
  ): Promise<Map<string, DepartmentRow>> {
    const departments = new Map<string, DepartmentRow>();

    for (const department of this.departments) {
      const result = await this.pool.query<DepartmentRow>(
        `
          INSERT INTO departments (
            school_id,
            name,
            code,
            description
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (school_id, code)
          DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            updated_at = now()
          RETURNING id, school_id, code, name
        `,
        [schoolId, department.name, department.code, department.description],
      );

      departments.set(department.code, result.rows[0]);
    }

    return departments;
  }

  private async ensureUsers(
    schoolId: string,
    departments: Map<string, DepartmentRow>,
  ): Promise<UserRow[]> {
    const passwordHash = await bcrypt.hash(this.defaultPassword, 12);
    const users: UserRow[] = [];

    for (const definition of this.users) {
      const department = departments.get(definition.departmentCode);
      if (!department) {
        throw new Error(
          `Missing seeded department for code ${definition.departmentCode}`,
        );
      }

      const result = await this.pool.query<UserRow>(
        `
          INSERT INTO users (
            school_id,
            department_id,
            email,
            username,
            full_name,
            password_hash,
            role,
            onboarding_completed
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          ON CONFLICT (email)
          DO UPDATE SET
            school_id = EXCLUDED.school_id,
            department_id = EXCLUDED.department_id,
            username = EXCLUDED.username,
            full_name = EXCLUDED.full_name,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            onboarding_completed = true,
            updated_at = now()
          RETURNING id, email, school_id, department_id, role
        `,
        [
          schoolId,
          department.id,
          definition.email,
          definition.username,
          definition.fullName,
          passwordHash,
          definition.role,
        ],
      );

      users.push(result.rows[0]);
    }

    return users;
  }

  private async ensureCourses(
    schoolId: string,
    departments: Map<string, DepartmentRow>,
  ): Promise<Map<string, CourseRow>> {
    const courses = new Map<string, CourseRow>();

    for (const [departmentCode, seedCourses] of Object.entries(
      this.coursesByDepartmentCode,
    )) {
      const department = departments.get(departmentCode);
      if (!department) {
        continue;
      }

      for (const seedCourse of seedCourses) {
        const result = await this.pool.query<CourseRow>(
          `
            INSERT INTO courses (
              school_id,
              department_id,
              code,
              name,
              description,
              is_active
            )
            VALUES ($1, $2, $3, $4, $5, true)
            ON CONFLICT (school_id, code)
            DO UPDATE SET
              department_id = EXCLUDED.department_id,
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              is_active = true,
              updated_at = now()
            RETURNING id, school_id, department_id, code, name
          `,
          [
            schoolId,
            department.id,
            seedCourse.code,
            seedCourse.name,
            seedCourse.description,
          ],
        );

        courses.set(seedCourse.code, result.rows[0]);
      }
    }

    return courses;
  }

  private async findSchoolUsers(schoolId: string): Promise<UserRow[]> {
    const result = await this.pool.query<UserRow>(
      `
        SELECT id, email, school_id, department_id, role
        FROM users
        WHERE school_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [schoolId],
    );

    return result.rows;
  }

  private async ensureGeneralRoom(
    schoolId: string,
    creatorUserId: string | null,
  ): Promise<ChatRoomRow> {
    const existing = await this.pool.query<ChatRoomRow>(
      `
        SELECT id, room_type, department_id, group_id
        FROM chat_rooms
        WHERE school_id = $1
          AND room_type = 'general'
          AND is_archived = false
        LIMIT 1
      `,
      [schoolId],
    );

    if (existing.rowCount) {
      return existing.rows[0];
    }

    const created = await this.pool.query<ChatRoomRow>(
      `
        INSERT INTO chat_rooms (
          school_id,
          room_type,
          created_by,
          name,
          description
        )
        VALUES ($1, 'general', $2, $3, $4)
        RETURNING id, room_type, department_id, group_id
      `,
      [
        schoolId,
        creatorUserId,
        `${this.schoolName} Genel`,
        'School-wide general room seeded for local development.',
      ],
    );

    return created.rows[0];
  }

  private async ensureGeneralMemberships(
    roomId: string,
    schoolId: string,
    users: UserRow[],
  ): Promise<void> {
    for (const user of users) {
      await this.ensureMembership(
        schoolId,
        roomId,
        user.id,
        user.role === 'school_admin' ? 'owner' : user.role === 'moderator' ? 'admin' : 'member',
      );
    }
  }

  private async ensureDepartmentRoomsAndMemberships(
    schoolId: string,
    departments: Map<string, DepartmentRow>,
    users: UserRow[],
  ): Promise<void> {
    const usersByDepartmentId = new Map<string, UserRow[]>();

    for (const user of users) {
      if (!user.department_id) {
        continue;
      }

      const existing = usersByDepartmentId.get(user.department_id) ?? [];
      existing.push(user);
      usersByDepartmentId.set(user.department_id, existing);
    }

    for (const department of departments.values()) {
      const room = await this.ensureDepartmentRoom(schoolId, department, users);
      const members = usersByDepartmentId.get(department.id) ?? [];

      for (const member of members) {
        await this.ensureMembership(
          schoolId,
          room.id,
          member.id,
          member.role === 'school_admin' || member.role === 'moderator'
            ? 'admin'
            : 'member',
        );
      }
    }
  }

  private async ensureDepartmentRoom(
    schoolId: string,
    department: DepartmentRow,
    users: UserRow[],
  ): Promise<ChatRoomRow> {
    const existing = await this.pool.query<ChatRoomRow>(
      `
        SELECT id, room_type, department_id, group_id
        FROM chat_rooms
        WHERE school_id = $1
          AND room_type = 'department'
          AND department_id = $2
          AND is_archived = false
        LIMIT 1
      `,
      [schoolId, department.id],
    );

    if (existing.rowCount) {
      return existing.rows[0];
    }

    const createdBy = users.find(
      (user) =>
        user.department_id === department.id &&
        (user.role === 'school_admin' || user.role === 'moderator'),
    )?.id ?? users[0]?.id ?? null;

    const created = await this.pool.query<ChatRoomRow>(
      `
        INSERT INTO chat_rooms (
          school_id,
          room_type,
          department_id,
          created_by,
          name,
          description
        )
        VALUES ($1, 'department', $2, $3, $4, $5)
        RETURNING id, room_type, department_id, group_id
      `,
      [
        schoolId,
        department.id,
        createdBy,
        `${department.name} Chat`,
        `${department.name} department room seeded for local development.`,
      ],
    );

    return created.rows[0];
  }

  private findRoomOwner(users: UserRow[]): UserRow | null {
    return (
      users.find((user) => user.role === 'school_admin') ??
      users.find((user) => user.role === 'moderator') ??
      users[0] ??
      null
    );
  }

  private async ensureSampleGroupAndRoom(
    schoolId: string,
    users: UserRow[],
    departments: Map<string, DepartmentRow>,
  ): Promise<void> {
    const owner =
      users.find((user) => user.role === 'school_admin') ?? users[0] ?? null;
    if (!owner) {
      return;
    }

    const sampleGroup = await this.ensureSampleGroup(schoolId, owner.id);
    const groupRoom = await this.ensureGroupRoom(
      schoolId,
      sampleGroup.id,
      owner.id,
      departments.get('SE')?.name ?? 'Software Engineering',
    );

    const memberEmails = [
      'admin@isu.local',
      'student.software@isu.local',
      'student.computer@isu.local',
    ];

    for (const member of users.filter((user) => memberEmails.includes(user.email))) {
      await this.ensureMembership(
        schoolId,
        groupRoom.id,
        member.id,
        member.id === owner.id ? 'owner' : 'member',
      );
    }
  }

  private async ensureSampleGroup(
    schoolId: string,
    ownerId: string,
  ): Promise<GroupRow> {
    const existing = await this.pool.query<GroupRow>(
      `
        SELECT id, school_id, name
        FROM groups
        WHERE school_id = $1
          AND name = $2
        LIMIT 1
      `,
      [schoolId, 'Seed Study Group'],
    );

    if (existing.rowCount) {
      return existing.rows[0];
    }

    const created = await this.pool.query<GroupRow>(
      `
        INSERT INTO groups (
          school_id,
          owner_id,
          name,
          slug,
          description,
          visibility
        )
        VALUES ($1, $2, $3, $4, $5, 'private')
        RETURNING id, school_id, name
      `,
      [
        schoolId,
        ownerId,
        'Seed Study Group',
        'seed-study-group',
        'Sample study group seeded for local development.',
      ],
    );

    return created.rows[0];
  }

  private async ensureGroupRoom(
    schoolId: string,
    groupId: string,
    createdBy: string,
    departmentName: string,
  ): Promise<ChatRoomRow> {
    const existing = await this.pool.query<ChatRoomRow>(
      `
        SELECT id, room_type, department_id, group_id
        FROM chat_rooms
        WHERE school_id = $1
          AND room_type = 'group'
          AND group_id = $2
          AND is_archived = false
        LIMIT 1
      `,
      [schoolId, groupId],
    );

    if (existing.rowCount) {
      return existing.rows[0];
    }

    const created = await this.pool.query<ChatRoomRow>(
      `
        INSERT INTO chat_rooms (
          school_id,
          room_type,
          group_id,
          created_by,
          name,
          description
        )
        VALUES ($1, 'group', $2, $3, $4, $5)
        RETURNING id, room_type, department_id, group_id
      `,
      [
        schoolId,
        groupId,
        createdBy,
        'Seed Study Group Room',
        `${departmentName} cross-functional sample group room for local development.`,
      ],
    );

    return created.rows[0];
  }

  private async ensureMembership(
    schoolId: string,
    roomId: string,
    userId: string,
    roomRole: 'member' | 'admin' | 'owner',
  ): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO chat_room_members (
          school_id,
          room_id,
          user_id,
          room_role,
          is_active,
          left_at
        )
        VALUES ($1, $2, $3, $4, true, NULL)
        ON CONFLICT (room_id, user_id)
        DO UPDATE SET
          room_role = EXCLUDED.room_role,
          is_active = true,
          left_at = NULL,
          updated_at = now()
      `,
      [schoolId, roomId, userId, roomRole],
    );
  }
}
