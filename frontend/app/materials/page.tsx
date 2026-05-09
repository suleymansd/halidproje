"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AcademicMaterial,
  createMaterial,
  getMaterials
} from "../../lib/api";
import { clearAccessToken, getAccessToken } from "../../lib/auth";
import { NotificationBell } from "../../components/notification-bell";

export default function MaterialsPage() {
  const router = useRouter();
  const [materials, setMaterials] = useState<AcademicMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    void loadMaterials();
  }, [router]);

  const parsedFilterTags = useMemo(
    () =>
      tagsFilter
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagsFilter]
  );

  function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

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

  async function loadMaterials() {
    if (!ensureToken()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const safeDepartmentId = departmentFilter.trim();
      const safeCourseId = courseFilter.trim();
      const response = await getMaterials({
        departmentId:
          safeDepartmentId && isUuid(safeDepartmentId) ? safeDepartmentId : undefined,
        courseId: safeCourseId && isUuid(safeCourseId) ? safeCourseId : undefined,
        tags: parsedFilterTags.length ? parsedFilterTags : undefined
      });
      const items = response.items ?? [];
      const sortedItems =
        sort === "most_upvoted"
          ? [...items].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
          : [...items].sort((a, b) => {
              const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return bTime - aTime;
            });
      setMaterials(sortedItems);
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
      const safeDepartmentId = departmentId.trim();
      const safeCourseId = courseId.trim();
      const normalizedMaterialType = materialType.trim() || "pdf";
      const normalizedStorageUrl =
        storageUrl.trim() || "https://example.com/dev-placeholder.pdf";
      const normalizedFilename = filename.trim() || "dev-placeholder.pdf";
      const normalizedFileType = fileType.trim() || "application/pdf";
      const normalizedFileSize = fileSize.trim() || "12345";
      const created = await createMaterial({
        title: title.trim(),
        description: description.trim() || undefined,
        departmentId:
          safeDepartmentId && isUuid(safeDepartmentId) ? safeDepartmentId : undefined,
        courseId: safeCourseId && isUuid(safeCourseId) ? safeCourseId : undefined,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        materialType: normalizedMaterialType,
        storageUrl: normalizedStorageUrl,
        filename: normalizedFilename,
        fileType: normalizedFileType,
        fileSize: normalizedFileSize.replace(/\D/g, "") || "12345"
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

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <form
              onSubmit={onApplyFilters}
              className="rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.88)] p-4 backdrop-blur"
            >
              <h2 className="mb-3 text-sm font-semibold">Filters</h2>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">Department ID</span>
                <input
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">Course ID</span>
                <input
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
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
                <span className="mb-1 block text-xs text-slate-400">Department ID</span>
                <input
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">Course ID</span>
                <input
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
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
                <span className="mb-1 block text-xs text-slate-400">
                  Storage URL (optional)
                </span>
                <input
                  value={storageUrl}
                  onChange={(e) => setStorageUrl(e.target.value)}
                  placeholder="https://example.com/dev-placeholder.pdf"
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">
                  Filename (optional)
                </span>
                <input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="dev-placeholder.pdf"
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs text-slate-400">
                  File Type (optional)
                </span>
                <input
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  placeholder="application/pdf"
                  className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs text-slate-400">
                  File Size (digits only, optional)
                </span>
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
              <p className="text-sm text-slate-400">No materials found.</p>
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
                      <span className="text-xs text-slate-400">
                        {formatDate(material.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-slate-300">
                      {material.description || "No description"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span>Dept: {material.department?.name || material.departmentId || "-"}</span>
                      <span>Course: {material.course?.name || material.courseId || "-"}</span>
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
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
