"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AcademicMaterial, Course, getCourseById, getMaterials } from "../../../lib/api";
import { clearAccessToken, getAccessToken } from "../../../lib/auth";
import { NotificationBell } from "../../../components/notification-bell";

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = typeof params?.id === "string" ? params.id : "";
  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<AcademicMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }
    if (!courseId) return;
    void bootstrap();
  }, [courseId, router]);

  async function bootstrap() {
    setLoading(true);
    setError(null);
    try {
      const [courseData, materialResponse] = await Promise.all([
        getCourseById(courseId),
        getMaterials({ courseId })
      ]);
      setCourse(courseData);
      setMaterials(materialResponse.items ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load course.";
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

  function logout() {
    clearAccessToken();
    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/courses" className="rounded-md px-2 py-1 hover:bg-slate-800">Courses</Link>
            <Link href="/departments" className="rounded-md px-2 py-1 hover:bg-slate-800">Departments</Link>
            <Link href="/materials" className="rounded-md px-2 py-1 hover:bg-slate-800">Materials</Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={logout} className="rounded-md border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800">
              Logout
            </button>
          </div>
        </header>

        {loading ? <p className="text-sm text-slate-400">Loading course...</p> : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {!loading && !error && course ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{course.code || "Course"}</p>
              <h1 className="mt-2 text-2xl font-semibold">{course.name}</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-400">{course.description || "No course description available."}</p>
              {course.department ? (
                <p className="mt-3 text-sm text-slate-500">
                  Department: <Link href={`/departments/${course.department.id}`} className="text-cyan-300 hover:text-cyan-200">{course.department.name}</Link>
                </p>
              ) : null}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Related Materials</h2>
                <Link href="/materials" className="text-sm text-cyan-300 hover:text-cyan-200">Browse all materials</Link>
              </div>
              {materials.length === 0 ? (
                <p className="text-sm text-slate-400">No materials have been uploaded for this course yet.</p>
              ) : (
                <div className="space-y-3">
                  {materials.map((material) => (
                    <Link key={material.id} href={`/materials/${material.id}`} className="block rounded-lg border border-slate-800 bg-slate-950 p-4 hover:border-slate-700">
                      <h3 className="font-medium">{material.title}</h3>
                      <p className="mt-2 text-sm text-slate-400">{material.description || "No description."}</p>
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
