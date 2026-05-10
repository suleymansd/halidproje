"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AcademicMaterial,
  Course,
  DepartmentDetail,
  GroupSummary,
  getCourses,
  getDepartmentById,
  getGroups,
  getMaterials
} from "../../../lib/api";
import { clearAccessToken, getAccessToken } from "../../../lib/auth";
import { NotificationBell } from "../../../components/notification-bell";

export default function DepartmentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const departmentId = typeof params?.id === "string" ? params.id : "";
  const [department, setDepartment] = useState<DepartmentDetail | null>(null);
  const [materials, setMaterials] = useState<AcademicMaterial[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }
    if (!departmentId) return;
    void bootstrap();
  }, [departmentId, router]);

  async function bootstrap() {
    setLoading(true);
    setError(null);
    try {
      const [departmentData, materialResponse, courseList, groupList] = await Promise.all([
        getDepartmentById(departmentId),
        getMaterials({ departmentId }),
        getCourses(),
        getGroups()
      ]);

      setDepartment(departmentData);
      setMaterials(materialResponse.items ?? []);
      setCourses(courseList.filter((course) => course.departmentId === departmentId));
      const query = departmentData.name.toLowerCase();
      setGroups(
        groupList.filter((group) =>
          [group.name, group.description]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load department.";
      if (message.includes("401") || message.includes("Unauthorized") || message.includes("NO_TOKEN")) {
        clearAccessToken();
        router.replace("/");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const relatedGroupsNote = useMemo(() => {
    if (groups.length > 0) return null;
    return "Group metadata is not explicitly mapped to departments yet, so only matching group names and descriptions are shown here.";
  }, [groups.length]);

  function logout() {
    clearAccessToken();
    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/departments" className="rounded-md px-2 py-1 hover:bg-slate-800">Departments</Link>
            <Link href="/courses" className="rounded-md px-2 py-1 hover:bg-slate-800">Courses</Link>
            <Link href="/materials" className="rounded-md px-2 py-1 hover:bg-slate-800">Materials</Link>
            <Link href="/groups" className="rounded-md px-2 py-1 hover:bg-slate-800">Groups</Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={logout} className="rounded-md border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800">
              Logout
            </button>
          </div>
        </header>

        {loading ? <p className="text-sm text-slate-400">Loading department...</p> : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {!loading && !error && department ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{department.code || "Department"}</p>
              <h1 className="mt-2 text-2xl font-semibold">{department.name}</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-400">
                {department.description || "No department description available."}
              </p>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Related Courses</h2>
                <Link href="/courses" className="text-sm text-cyan-300 hover:text-cyan-200">Browse all courses</Link>
              </div>
              {courses.length === 0 ? (
                <p className="text-sm text-slate-400">No active courses found for this department.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {courses.map((course) => (
                    <Link key={course.id} href={`/courses/${course.id}`} className="rounded-lg border border-slate-800 bg-slate-950 p-4 hover:border-slate-700">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{course.code || "Course"}</p>
                      <h3 className="mt-2 font-medium">{course.name}</h3>
                      <p className="mt-2 text-sm text-slate-400">{course.description || "No course description."}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Related Materials</h2>
                <Link href={`/materials?department=${department.id}`} className="text-sm text-cyan-300 hover:text-cyan-200">
                  Open materials
                </Link>
              </div>
              {materials.length === 0 ? (
                <p className="text-sm text-slate-400">No materials have been shared for this department yet.</p>
              ) : (
                <div className="space-y-3">
                  {materials.slice(0, 8).map((material) => (
                    <Link key={material.id} href={`/materials/${material.id}`} className="block rounded-lg border border-slate-800 bg-slate-950 p-4 hover:border-slate-700">
                      <h3 className="font-medium">{material.title}</h3>
                      <p className="mt-2 text-sm text-slate-400">{material.description || "No description."}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Related Groups</h2>
                <Link href="/groups" className="text-sm text-cyan-300 hover:text-cyan-200">Browse groups</Link>
              </div>
              {groups.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-400">No matching groups found for this department.</p>
                  {relatedGroupsNote ? <p className="text-xs text-slate-500">{relatedGroupsNote}</p> : null}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {groups.map((group) => (
                    <Link key={group.id} href={`/groups/${group.id}`} className="rounded-lg border border-slate-800 bg-slate-950 p-4 hover:border-slate-700">
                      <h3 className="font-medium">{group.name}</h3>
                      <p className="mt-2 text-sm text-slate-400">{group.description || "No description."}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
