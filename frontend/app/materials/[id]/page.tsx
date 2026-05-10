"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AcademicMaterial,
  ApiError,
  Department,
  MaterialComment,
  UserProfile,
  addMaterialComment,
  bookmarkMaterial,
  deleteMaterial,
  getCurrentUser,
  getDepartments,
  getMaterialById,
  getMaterialComments,
  removeMaterialBookmark,
  removeMaterialVote,
  reportMaterial,
  updateMaterial,
  voteMaterial
} from "../../../lib/api";
import { clearAccessToken, getAccessToken } from "../../../lib/auth";
import { NotificationBell } from "../../../components/notification-bell";

type ReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "inappropriate_content"
  | "copyright"
  | "misinformation"
  | "other";

export default function MaterialDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const materialId = params.id;

  const [material, setMaterial] = useState<AcademicMaterial | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [comments, setComments] = useState<MaterialComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDepartmentId, setEditDepartmentId] = useState("");
  const [editCourseId, setEditCourseId] = useState("");
  const [editTags, setEditTags] = useState("");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("inappropriate_content");
  const [reportDescription, setReportDescription] = useState("Reported from frontend test");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }

    void bootstrapPage();
  }, [router, materialId]);

  const canManageMaterial = useMemo(() => {
    if (!material || !currentUser) return false;
    if (material.uploaderId && material.uploaderId === currentUser.id) return true;
    return ["super_admin", "school_admin", "moderator"].includes(currentUser.role ?? "");
  }, [currentUser, material]);

  async function bootstrapPage() {
    setLoading(true);
    setError(null);
    try {
      const [user, detail, commentsResponse, departmentsResponse] = await Promise.all([
        getCurrentUser(),
        getMaterialById(materialId),
        getMaterialComments(materialId),
        getDepartments()
      ]);
      setCurrentUser(user);
      setDepartments(departmentsResponse);
      setComments(commentsResponse.items ?? []);
      applyMaterialState(detail);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err instanceof ApiError && err.status === 404 ? "Material not found." : "Failed to load material detail.");
    } finally {
      setLoading(false);
      setCommentLoading(false);
    }
  }

  function applyMaterialState(data: AcademicMaterial) {
    setMaterial(data);
    setIsBookmarked(Boolean(data.isBookmarked));
    setHasVoted((data.myVote ?? 0) > 0);
    setEditTitle(data.title ?? "");
    setEditDescription(data.description ?? "");
    setEditDepartmentId(data.departmentId ?? "");
    setEditCourseId(data.courseId ?? "");
    setEditTags((data.tags ?? []).map((tag) => tag.name).join(", "));
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
    const message =
      err instanceof ApiError
        ? `${err.status}:${err.message}`
        : err instanceof Error
          ? err.message
          : "";
    if (message.includes("NO_TOKEN") || message.includes("401") || message.includes("Unauthorized")) {
      clearAccessToken();
      router.replace("/");
      return true;
    }
    return false;
  }

  function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  function parseTags(value: string) {
    return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
  }

  async function onSubmitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentInput.trim() || !ensureToken()) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await addMaterialComment(materialId, commentInput.trim());
      setComments((prev) => [...prev, created]);
      setCommentInput("");
      setSuccess("Comment added.");
    } catch (err) {
      if (handleAuthError(err)) return;
      setError("Failed to add comment.");
    } finally {
      setActionLoading(false);
    }
  }

  async function onVote() {
    if (!ensureToken()) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (hasVoted) {
        await removeMaterialVote(materialId);
        setHasVoted(false);
        setMaterial((prev) =>
          prev
            ? {
                ...prev,
                myVote: 0,
                voteCount: Math.max((prev.voteCount ?? 1) - 1, 0),
                voteScore: Math.max((prev.voteScore ?? 1) - 1, 0)
              }
            : prev
        );
      } else {
        await voteMaterial(materialId, 1);
        setHasVoted(true);
        setMaterial((prev) =>
          prev
            ? {
                ...prev,
                myVote: 1,
                voteCount: (prev.voteCount ?? 0) + 1,
                voteScore: (prev.voteScore ?? 0) + 1
              }
            : prev
        );
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      setError("Vote action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function onBookmark() {
    if (!ensureToken()) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (isBookmarked) {
        await removeMaterialBookmark(materialId);
        setIsBookmarked(false);
        setMaterial((prev) => (prev ? { ...prev, isBookmarked: false, bookmarkedByMe: false } : prev));
      } else {
        await bookmarkMaterial(materialId);
        setIsBookmarked(true);
        setMaterial((prev) => (prev ? { ...prev, isBookmarked: true, bookmarkedByMe: true } : prev));
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      setError("Bookmark action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function onReport() {
    if (!ensureToken()) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await reportMaterial(materialId, reportReason, reportDescription.trim());
      setSuccess("Material reported.");
    } catch (err) {
      if (handleAuthError(err)) return;
      setError("Report failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function onSaveMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!material || !canManageMaterial || !ensureToken()) return;

    const normalizedTitle = editTitle.trim();
    if (!normalizedTitle) {
      setError("Title is required.");
      return;
    }

    const safeDepartmentId = editDepartmentId.trim();
    const safeCourseId = editCourseId.trim();

    setSaveLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateMaterial(material.id, {
        title: normalizedTitle,
        description: editDescription.trim() || undefined,
        departmentId:
          safeDepartmentId && isUuid(safeDepartmentId) ? safeDepartmentId : undefined,
        courseId: safeCourseId && isUuid(safeCourseId) ? safeCourseId : undefined,
        tags: parseTags(editTags)
      });
      applyMaterialState(updated);
      setIsEditing(false);
      setSuccess("Material updated.");
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err instanceof ApiError && err.status === 403) {
        setError("Only the uploader or a moderator can edit this material.");
      } else {
        setError("Failed to update material.");
      }
    } finally {
      setSaveLoading(false);
    }
  }

  async function onDeleteMaterial() {
    if (!material || !canManageMaterial || !ensureToken()) return;

    setDeleteLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteMaterial(material.id);
      router.replace("/materials?deleted=1");
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err instanceof ApiError && err.status === 403) {
        setError("Only the uploader or a moderator can delete this material.");
      } else {
        setError("Failed to delete material.");
      }
      setDeleteLoading(false);
    }
  }

  function formatDate(value?: string | null) {
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
      <div className="relative mx-auto max-w-5xl px-4 py-4">
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

        {loading ? (
          <section className="rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.88)] p-6 text-sm text-slate-400 backdrop-blur">
            Loading material...
          </section>
        ) : !material ? (
          <section className="rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.88)] p-6 text-sm text-slate-400 backdrop-blur">
            Material not found.
          </section>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.88)] p-4 shadow-[0_20px_80px_rgba(8,19,29,0.28)] backdrop-blur">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#7fb7dc]">Material Detail</p>
                  <h1 className="mt-1 text-2xl font-semibold">{material.title}</h1>
                  <p className="mt-2 text-sm text-slate-400">
                    Uploaded by {material.uploader?.fullName || material.uploader?.username || "Unknown User"}
                  </p>
                </div>
                {canManageMaterial ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setIsEditing((prev) => !prev);
                        setConfirmDelete(false);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="rounded-full border border-[rgba(127,183,220,0.2)] px-3 py-1.5 text-sm hover:bg-[rgba(56,128,176,0.12)]"
                    >
                      {isEditing ? "Cancel Edit" : "Edit"}
                    </button>
                    <button
                      onClick={() => {
                        setConfirmDelete(true);
                        setIsEditing(false);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="rounded-full border border-rose-400/35 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-500/10"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-400">
                <span>Created: {formatDate(material.createdAt)}</span>
                <span>Updated: {formatDate(material.updatedAt ?? material.createdAt)}</span>
                <span>Department: {material.department?.name || material.departmentId || "-"}</span>
                <span>Course: {material.course?.name || material.courseId || "-"}</span>
                <span>Votes: {material.voteCount ?? 0}</span>
              </div>

              {!isEditing ? (
                <>
                  <p className="mb-4 whitespace-pre-wrap text-sm text-slate-300">
                    {material.description || "No description."}
                  </p>
                  {material.tags?.length ? (
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {material.tags.map((tag, index) => (
                        <span
                          key={`${material.id}-detail-tag-${tag.name}-${index}`}
                          className="rounded-full bg-[rgba(56,128,176,0.14)] px-2 py-0.5 text-[11px] text-[#b4d8ee]"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-4 text-sm text-slate-500">No tags yet.</p>
                  )}
                </>
              ) : (
                <form onSubmit={onSaveMaterial} className="mb-4 grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs text-slate-400">Title</span>
                    <input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs text-slate-400">Description</span>
                    <textarea
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Department</span>
                    <select
                      value={editDepartmentId}
                      onChange={(event) => setEditDepartmentId(event.target.value)}
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
                  <label className="block">
                    <span className="mb-1 block text-xs text-slate-400">Course ID</span>
                    <input
                      value={editCourseId}
                      onChange={(event) => setEditCourseId(event.target.value)}
                      placeholder="Optional course UUID"
                      className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs text-slate-400">Tags</span>
                    <input
                      value={editTags}
                      onChange={(event) => setEditTags(event.target.value)}
                      placeholder="comma, separated, tags"
                      className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                    />
                  </label>
                  <div className="sm:col-span-2 flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={saveLoading}
                      className="rounded-full bg-[#3880b0] px-4 py-2 text-sm font-medium text-[#08131d] hover:bg-[#4e93c1] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {saveLoading ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (material) {
                          applyMaterialState(material);
                        }
                        setIsEditing(false);
                      }}
                      className="rounded-full border border-[rgba(127,183,220,0.2)] px-4 py-2 text-sm hover:bg-[rgba(56,128,176,0.12)]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onVote}
                  disabled={actionLoading}
                  className="rounded-full bg-[#3880b0] px-3 py-2 text-sm font-medium text-[#08131d] hover:bg-[#4e93c1] disabled:opacity-70"
                >
                  {hasVoted ? "Remove Vote" : "Vote"}
                </button>
                <button
                  onClick={onBookmark}
                  disabled={actionLoading}
                  className="rounded-full border border-[rgba(127,183,220,0.2)] px-3 py-2 text-sm hover:bg-[rgba(56,128,176,0.12)] disabled:opacity-70"
                >
                  {isBookmarked ? "Remove Bookmark" : "Bookmark"}
                </button>
                <button
                  onClick={onReport}
                  disabled={actionLoading}
                  className="rounded-full border border-rose-400/35 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/10 disabled:opacity-70"
                >
                  Report
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">Report reason</span>
                  <select
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value as ReportReason)}
                    className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                  >
                    <option value="inappropriate_content">Inappropriate content</option>
                    <option value="spam">Spam</option>
                    <option value="harassment">Harassment</option>
                    <option value="hate_speech">Hate speech</option>
                    <option value="copyright">Copyright</option>
                    <option value="misinformation">Misinformation</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">Report description</span>
                  <input
                    value={reportDescription}
                    onChange={(event) => setReportDescription(event.target.value)}
                    className="w-full rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                  />
                </label>
              </div>

              {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
              {success ? <p className="mt-3 text-sm text-emerald-400">{success}</p> : null}
            </section>

            <section className="rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.88)] p-4 shadow-[0_20px_80px_rgba(8,19,29,0.28)] backdrop-blur">
              <h2 className="mb-3 text-lg font-semibold">Comments</h2>
              <form onSubmit={onSubmitComment} className="mb-4 flex gap-2">
                <input
                  value={commentInput}
                  onChange={(event) => setCommentInput(event.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 rounded-xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-3 py-2 text-sm outline-none ring-[#3880b0] focus:ring-2"
                />
                <button
                  type="submit"
                  disabled={actionLoading || !commentInput.trim()}
                  className="rounded-full bg-[#3880b0] px-4 py-2 text-sm font-medium text-[#08131d] hover:bg-[#4e93c1] disabled:opacity-70"
                >
                  Comment
                </button>
              </form>

              {commentLoading ? (
                <p className="text-sm text-slate-400">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-slate-400">No comments yet.</p>
              ) : (
                <div className="space-y-2">
                  {comments.map((comment) => (
                    <article
                      key={comment.id}
                      className="rounded-2xl border border-[rgba(127,183,220,0.12)] bg-[rgba(8,19,29,0.76)] p-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span>{comment.user?.fullName || comment.user?.username || "Unknown User"}</span>
                        <span>{formatDate(comment.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-200">{comment.content}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {confirmDelete && material ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.96)] p-5 shadow-[0_20px_80px_rgba(8,19,29,0.45)] backdrop-blur">
            <h2 className="text-lg font-semibold">Delete material?</h2>
            <p className="mt-2 text-sm text-slate-400">
              This will remove <span className="text-slate-200">{material.title}</span> from the materials feed.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-full border border-[rgba(127,183,220,0.2)] px-4 py-2 text-sm hover:bg-[rgba(56,128,176,0.12)]"
              >
                Cancel
              </button>
              <button
                onClick={onDeleteMaterial}
                disabled={deleteLoading}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
