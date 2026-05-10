"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AcademicMaterial,
  Course,
  Department,
  createMaterial,
  getCourses,
  getDepartments,
  getMaterials
} from "../../lib/api";
import { clearAccessToken, getAccessToken } from "../../lib/auth";
import { NotificationBell } from "../../components/notification-bell";

export default function MaterialsPage() {
  const PAGE_SIZE = 12;
  const router = useRouter();
  const [materials, setMaterials] = useState<AcademicMaterial[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [departmentFilter, setDepartmentFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [tagsFilter, setTagsFilter] = useState("");
  const [sort, setSort] = useState<"newest" | "most_upvoted">("newest");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [tags, setTags] = useState("");
  const [materialType, setMaterialType] = useState("pdf");
  const [storageUrl, setStorageUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [fileType, setFileType] = useState("application/pdf");
  const [fileSize, setFileSize] = useState("");

  useEffect(() => {
    if (!ensureToken()) {
      return;
    }
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const department = params?.get("department");
    const course = params?.get("course");
    if (department) {
      setDepartmentFilter(department);
    }
    if (course) {
      setCourseFilter(course);
    }
    void bootstrap();
  }, [router]);

  const parsedFilterTags = useMemo(
    () =>
      tagsFilter
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagsFilter]
  );

  const filteredCourses = useMemo(() => {
    if (!departmentFilter) return courses;
    return courses.filter((course) => course.departmentId === departmentFilter);
  }, [courses, departmentFilter]);

  const createCourses = useMemo(() => {
    if (!departmentId) return courses;
    return courses.filter((course) => course.departmentId === departmentId);
  }, [courses, departmentId]);

  function ensureToken() {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return false;
    }
    return true;
  }

  function handleAuthError(err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("NO_TOKEN") || message.includes("401") || message.includes("Unauthorized")) {
      clearAccessToken();
      router.replace("/");
      return true;
    }
    return false;
  }

  async function bootstrap() {
    setLoading(true);
    setError(null);
    try {
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const [materialResponse, departmentList, courseList] = await Promise.all([
        getMaterials({
          departmentId: params?.get("department") || undefined,
          courseId: params?.get("course") || undefined
        }),
        getDepartments(),
        getCourses()
      ]);
      setDepartments(departmentList);
      setCourses(courseList);
      setMaterials(sortItems(materialResponse.items ?? [], sort));
      setNextCursor(materialResponse.nextCursor ?? null);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError("Failed to load materials.");
    } finally {
      setLoading(false);
    }
  }

  function sortItems(items: AcademicMaterial[], mode: "newest" | "most_upvoted") {
    return mode === "most_upvoted"
      ? [...items].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
      : [...items].sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
  }

  async function loadMaterials() {
    if (!ensureToken()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getMaterials({
        departmentId: departmentFilter || undefined,
        courseId: courseFilter || undefined,
        tags: parsedFilterTags.length ? parsedFilterTags : undefined
      });
      setMaterials(sortItems(response.items ?? [], sort));
      setNextCursor(response.nextCursor ?? null);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError("Failed to load materials.");
    } finally {
      setLoading(false);
    }
  }

  async function onApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadMaterials();
  }

  async function onCreateMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      if (!ensureToken()) {
        return;
      }
      const created = await createMaterial({
        title: title.trim(),
        description: description.trim() || undefined,
        departmentId: departmentId || undefined,
        courseId: courseId || undefined,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        materialType: materialType.trim() || "pdf",
        storageUrl: storageUrl.trim() || "https://example.com/dev-placeholder.pdf",
        filename: filename.trim() || "dev-placeholder.pdf",
        fileType: fileType.trim() || "application/pdf",
        fileSize: fileSize.trim().replace(/\D/g, "") || "12345"
      });
      setSuccess("Material created.");
      setTitle("");
      setDescription("");
      setDepartmentId("");
      setCourseId("");
      setTags("");
      setMaterialType("pdf");
      setStorageUrl("");
      setFilename("");
      setFileType("application/pdf");
      setFileSize("");
      setMaterials((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError("Failed to create material.");
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(value?: string) {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  }

  function logout() {
    clearAccessToken();
    router.replace("/");
  }

  async function loadMoreMaterials() {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError(null);
    try {
      const response = await getMaterials({
        departmentId: departmentFilter || undefined,
        courseId: courseFilter || undefined,
        tags: parsedFilterTags.length ? parsedFilterTags : undefined,
        cursor: nextCursor
      });

      setMaterials((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const merged = [...prev, ...(response.items ?? []).filter((item) => !existingIds.has(item.id))];
        return sortItems(merged, sort);
      });
      setNextCursor(response.nextCursor ?? null);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError("Failed to load more materials.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="materials-scene relative min-h-screen overflow-hidden text-slate-100">
      <div className="materials-pattern pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-4 py-4">
        <header className="mb-4 flex items-center justify-between rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.9)] px-4 py-3 shadow-[0_20px_80px_rgba(8,19,29,0.35)] backdrop-blur">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/chat" className="rounded-full px-3 py-1.5 hover:bg-[rgba(56,128,176,0.12)]">
              Chat
            </Link>
            <Link
              href="/materials"
              className="rounded-full bg-[#3880b0] px-3 py-1.5 font-medium text-[#08131d]"
            >
              Materials
            </Link>
            <Link href="/search" className="rounded-full px-3 py-1.5 hover:bg-[rgba(56,128,176,0.12)]">
              Search
            </Link>
            <Link href="/departments" className="rounded-full px-3 py-1.5 hover:bg-[rgba(56,128,176,0.12)]">
              Departments
            </Link>
            <Link href="/courses" className="rounded-full px-3 py-1.5 hover:bg-[rgba(56,128,176,0.12)]">
              Courses
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={logout}
              className="rounded-full border border-[rgba(127,183,220,0.2)] px-3 py-1.5 text-sm hover:bg-[rgba(56,128,176,0.12)]"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-300">
          <Link href="/departments" className="rounded-full border border-[rgba(127,183,220,0.18)] px-3 py-1.5 hover:bg-[rgba(56,128,176,0.12)]">
            Browse departments
          </Link>
          <Link href="/courses" className="rounded-full border border-[rgba(127,183,220,0.18)] px-3 py-1.5 hover:bg-[rgba(56,128,176,0.12)]">
            Browse courses
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <form
              onSubmit={onApplyFilters}
              className="rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.88)] p-4 backdrop-blur"
            >
              <h2 className="mb-3 text-sm font-semibold">Filters</h2>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">Department</span>
                <select
                  value={departmentFilter}
                  onChange={(e) => {
                    setDepartmentFilter(e.target.value);
                    setCourseFilter("");
                  }}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                >
                  <option value="">All departments</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">Course</span>
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                >
                  <option value="">All courses</option>
                  {filteredCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code ? `${course.code} · ` : ""}
                      {course.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">Tags (comma)</span>
                <input
                  value={tagsFilter}
                  onChange={(e) => setTagsFilter(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs text-slate-400">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "newest" | "most_upvoted")}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                >
                  <option value="newest">Newest</option>
                  <option value="most_upvoted">Most upvoted</option>
                </select>
              </label>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#3880b0] px-3 py-2 text-sm font-medium text-[#08131d] hover:bg-[#4e93c1]"
              >
                Apply Filters
              </button>
            </form>

            <form
              onSubmit={onCreateMaterial}
              className="rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.88)] p-4 backdrop-blur"
            >
              <h2 className="mb-3 text-sm font-semibold">Create Material</h2>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">Title</span>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">Department</span>
                <select
                  value={departmentId}
                  onChange={(e) => {
                    setDepartmentId(e.target.value);
                    setCourseId("");
                  }}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                >
                  <option value="">No department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">Course</span>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                >
                  <option value="">No course</option>
                  {createCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code ? `${course.code} · ` : ""}
                      {course.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs text-slate-400">Tags (comma)</span>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">
                  Material Type (default: pdf)
                </span>
                <input
                  value={materialType}
                  onChange={(e) => setMaterialType(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">Storage URL (optional)</span>
                <input
                  value={storageUrl}
                  onChange={(e) => setStorageUrl(e.target.value)}
                  placeholder="https://example.com/dev-placeholder.pdf"
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">Filename (optional)</span>
                <input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="dev-placeholder.pdf"
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">File Type (optional)</span>
                <input
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  placeholder="application/pdf"
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs text-slate-400">File Size (digits only, optional)</span>
                <input
                  value={fileSize}
                  onChange={(e) => setFileSize(e.target.value)}
                  placeholder="12345"
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#3880b0] px-3 py-2 text-sm font-medium text-[#08131d] hover:bg-[#4e93c1] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
            </form>
          </aside>

          <section className="rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.88)] p-4 shadow-[0_20px_80px_rgba(8,19,29,0.28)] backdrop-blur">
            <h2 className="mb-3 text-lg font-semibold">Academic Materials</h2>
            {error ? <p className="mb-3 text-sm text-rose-400">{error}</p> : null}
            {success ? <p className="mb-3 text-sm text-emerald-400">{success}</p> : null}

            {loading ? (
              <p className="text-sm text-slate-400">Loading materials...</p>
            ) : materials.length === 0 ? (
              <p className="text-sm text-slate-400">No materials found for the selected filters.</p>
            ) : (
              <div className="space-y-3">
                {materials.map((material) => (
                  <Link
                    key={material.id}
                    href={`/materials/${material.id}`}
                    className="block rounded-2xl border border-[rgba(127,183,220,0.14)] bg-[rgba(8,19,29,0.76)] p-3 hover:border-[rgba(127,183,220,0.3)]"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold">{material.title}</h3>
                      <span className="text-xs text-slate-400">{formatDate(material.createdAt)}</span>
                    </div>
                    <p className="line-clamp-2 text-sm text-slate-300">
                      {material.description || "No description"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>Dept: {material.department?.name || "-"}</span>
                      <span>Course: {material.course?.name || "-"}</span>
                      <span>Votes: {material.voteCount ?? 0}</span>
                      <span>{material.isBookmarked ? "Bookmarked" : "Not bookmarked"}</span>
                    </div>
                    {material.tags?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {material.tags.map((tag, index) => (
                          <span
                            key={`${material.id}-tag-${tag.name}-${index}`}
                            className="rounded-full bg-[rgba(56,128,176,0.14)] px-2 py-0.5 text-[11px] text-[#b4d8ee]"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </Link>
                ))}
                {nextCursor ? (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => void loadMoreMaterials()}
                      disabled={loadingMore}
                      className="rounded-xl border border-[rgba(127,183,220,0.16)] px-4 py-2 text-sm text-slate-300 hover:bg-[rgba(56,128,176,0.12)] disabled:opacity-60"
                    >
                      {loadingMore ? "Loading..." : "More materials"}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
