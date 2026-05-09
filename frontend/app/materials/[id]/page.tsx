"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AcademicMaterial,
  MaterialComment,
  addMaterialComment,
  bookmarkMaterial,
  getMaterialById,
  getMaterialComments,
  removeMaterialBookmark,
  removeMaterialVote,
  reportMaterial,
  voteMaterial
} from "../../../lib/api";
import { clearAccessToken, getAccessToken } from "../../../lib/auth";
import { NotificationBell } from "../../../components/notification-bell";

export default function MaterialDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const materialId = params.id;

  const [material, setMaterial] = useState<AcademicMaterial | null>(null);
  const [comments, setComments] = useState<MaterialComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [reportReason, setReportReason] = useState<
    | "spam"
    | "harassment"
    | "hate_speech"
    | "inappropriate_content"
    | "copyright"
    | "misinformation"
    | "other"
  >("inappropriate_content");
  const [reportDescription, setReportDescription] = useState(
    "Reported from frontend test"
  );

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }
    void loadDetail();
    void loadComments();
  }, [router, materialId]);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMaterialById(materialId);
      setMaterial(data);
      setIsBookmarked(Boolean(data.isBookmarked));
    } catch {
      setError("Failed to load material detail.");
    } finally {
      setLoading(false);
    }
  }

  async function loadComments() {
    setCommentLoading(true);
    try {
      const data = await getMaterialComments(materialId);
      setComments(data.items ?? []);
    } catch {
      setError("Failed to load comments.");
    } finally {
      setCommentLoading(false);
    }
  }

  async function onSubmitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentInput.trim()) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await addMaterialComment(materialId, commentInput.trim());
      setComments((prev) => [...prev, created]);
      setCommentInput("");
      setSuccess("Comment added.");
    } catch {
      setError("Failed to add comment.");
    } finally {
      setActionLoading(false);
    }
  }

  async function onVote() {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (hasVoted) {
        await removeMaterialVote(materialId);
        setHasVoted(false);
        setMaterial((prev) =>
          prev ? { ...prev, voteCount: Math.max((prev.voteCount ?? 1) - 1, 0) } : prev
        );
      } else {
        await voteMaterial(materialId, 1);
        setHasVoted(true);
        setMaterial((prev) =>
          prev ? { ...prev, voteCount: (prev.voteCount ?? 0) + 1 } : prev
        );
      }
    } catch {
      setError("Vote action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function onBookmark() {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (isBookmarked) {
        await removeMaterialBookmark(materialId);
        setIsBookmarked(false);
      } else {
        await bookmarkMaterial(materialId);
        setIsBookmarked(true);
      }
    } catch {
      setError("Bookmark action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function onReport() {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await reportMaterial(materialId, reportReason, reportDescription.trim());
      setSuccess("Material reported.");
    } catch {
      setError("Report failed.");
    } finally {
      setActionLoading(false);
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
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <header className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/chat" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Chat
            </Link>
            <Link href="/materials" className="rounded-md bg-slate-800 px-2 py-1 text-cyan-300">
              Materials
            </Link>
            <Link href="/search" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Search
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={logout}
              className="rounded-md border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-slate-400">Loading material...</p>
        ) : !material ? (
          <p className="text-sm text-slate-400">Material not found.</p>
        ) : (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h1 className="mb-2 text-xl font-semibold">{material.title}</h1>
              <p className="mb-3 whitespace-pre-wrap text-sm text-slate-300">
                {material.description || "No description"}
              </p>
              <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-400">
                <span>Created: {formatDate(material.createdAt)}</span>
                <span>Department: {material.department?.name || material.departmentId || "-"}</span>
                <span>Course: {material.course?.name || material.courseId || "-"}</span>
                <span>Votes: {material.voteCount ?? 0}</span>
              </div>
              {material.tags?.length ? (
                <div className="mb-4 flex flex-wrap gap-1">
                  {material.tags.map((tag, index) => (
                    <span
                      key={`${material.id}-detail-tag-${tag.name}-${index}`}
                      className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onVote}
                  disabled={actionLoading}
                  className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-70"
                >
                  {hasVoted ? "Remove Vote" : "Vote"}
                </button>
                <button
                  onClick={onBookmark}
                  disabled={actionLoading}
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-70"
                >
                  {isBookmarked ? "Remove Bookmark" : "Bookmark"}
                </button>
                <button
                  onClick={onReport}
                  disabled={actionLoading}
                  className="rounded-md border border-rose-700 px-3 py-2 text-sm text-rose-300 hover:bg-rose-900/30 disabled:opacity-70"
                >
                  Report
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-400">Report reason</span>
                  <select
                    value={reportReason}
                    onChange={(e) =>
                      setReportReason(
                        e.target.value as
                          | "spam"
                          | "harassment"
                          | "hate_speech"
                          | "inappropriate_content"
                          | "copyright"
                          | "misinformation"
                          | "other"
                      )
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
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
                    onChange={(e) => setReportDescription(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
                  />
                </label>
              </div>
              {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
              {success ? <p className="mt-3 text-sm text-emerald-400">{success}</p> : null}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="mb-3 text-lg font-semibold">Comments</h2>
              <form onSubmit={onSubmitComment} className="mb-4 flex gap-2">
                <input
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
                />
                <button
                  type="submit"
                  disabled={actionLoading || !commentInput.trim()}
                  className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-70"
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
                      className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span>
                          {comment.user?.fullName || comment.user?.username || "Unknown"}
                        </span>
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
    </main>
  );
}
