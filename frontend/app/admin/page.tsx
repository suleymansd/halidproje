"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ModerationReport, UserProfile, getCurrentUser, getModerationReports, reviewModerationReport } from "../../lib/api";
import { clearAccessToken, getAccessToken } from "../../lib/auth";
import { NotificationBell } from "../../components/notification-bell";

function canAccessAdmin(role?: string) {
  return role === "school_admin" || role === "moderator";
}

export default function AdminPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "dismissed" | "">("open");
  const [typeFilter, setTypeFilter] = useState<"message" | "material" | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }

    void bootstrap();
  }, [router]);

  async function bootstrap() {
    setLoading(true);
    setError(null);
    try {
      const me = await getCurrentUser();
      setProfile(me);
      if (!canAccessAdmin(me.role)) {
        setLoading(false);
        return;
      }
      await loadReports("open", "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load admin panel.";
      if (message.includes("401") || message.includes("Unauthorized") || message.includes("NO_TOKEN")) {
        clearAccessToken();
        router.replace("/");
        return;
      }
      setError(message);
      setLoading(false);
    }
  }

  async function loadReports(
    nextStatus: "open" | "resolved" | "dismissed" | "",
    nextType: "message" | "material" | ""
  ) {
    setLoading(true);
    setError(null);
    try {
      setReports(
        await getModerationReports({
          status: nextStatus || undefined,
          referenceType: nextType || undefined,
          limit: 50
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }

  async function onReview(reportId: string, status: "resolved" | "dismissed") {
    setReviewingId(reportId);
    setError(null);
    try {
      const updated = await reviewModerationReport(reportId, { status });
      setReports((prev) => prev.map((report) => (report.id === reportId ? updated : report)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review report.");
    } finally {
      setReviewingId(null);
    }
  }

  const unsupportedUserReports = useMemo(
    () => reports.filter((report) => report.referenceType === "user").length === 0,
    [reports]
  );

  function logout() {
    clearAccessToken();
    router.replace("/");
  }

  if (!loading && profile && !canAccessAdmin(profile.role)) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h1 className="text-xl font-semibold">Admin Access Required</h1>
          <p className="mt-2 text-sm text-slate-400">This panel is restricted to moderators and school admins.</p>
          <Link href="/chat" className="mt-4 inline-flex rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950">
            Back to chat
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/chat" className="rounded-md px-2 py-1 hover:bg-slate-800">Chat</Link>
            <Link href="/admin" className="rounded-md bg-slate-800 px-2 py-1 text-cyan-300">Moderation</Link>
            <Link href="/admin/tools" className="rounded-md px-2 py-1 hover:bg-slate-800">Admin Tools</Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={logout} className="rounded-md border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800">
              Logout
            </button>
          </div>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Moderation Panel</h1>
              <p className="mt-1 text-sm text-slate-400">Review reported messages and materials for your school.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(event) => {
                  const value = event.target.value as "open" | "resolved" | "dismissed" | "";
                  setStatusFilter(value);
                  void loadReports(value, typeFilter);
                }}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <select
                value={typeFilter}
                onChange={(event) => {
                  const value = event.target.value as "message" | "material" | "";
                  setTypeFilter(value);
                  void loadReports(statusFilter, value);
                }}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="">All types</option>
                <option value="message">Messages</option>
                <option value="material">Materials</option>
              </select>
            </div>
          </div>

          {error ? <p className="mb-3 text-sm text-rose-400">{error}</p> : null}
          {unsupportedUserReports ? (
            <p className="mb-3 text-xs text-slate-500">Reported users are not supported by the current backend schema.</p>
          ) : null}

          {loading ? (
            <p className="text-sm text-slate-400">Loading reports...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-slate-400">No reports found for the current filters.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <article key={report.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] uppercase text-slate-400">
                          {report.referenceType}
                        </span>
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] uppercase text-slate-400">
                          {report.status}
                        </span>
                      </div>
                      <h2 className="mt-2 font-medium">{report.subjectPreview || "No preview available"}</h2>
                      <p className="mt-2 text-sm text-slate-400">
                        Reason: {report.reason}
                        {report.description ? ` · ${report.description}` : ""}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Reporter: {report.reporter?.fullName || report.reporter?.username || report.reporterId}
                        {" · "}
                        Target: {report.targetUser?.fullName || report.targetUser?.username || "Unknown"}
                      </p>
                    </div>

                    {report.status === "open" || report.status === "under_review" ? (
                      <div className="flex gap-2">
                        <button
                          disabled={reviewingId === report.id}
                          onClick={() => void onReview(report.id, "dismissed")}
                          className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-60"
                        >
                          Dismiss
                        </button>
                        <button
                          disabled={reviewingId === report.id}
                          onClick={() => void onReview(report.id, "resolved")}
                          className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
                        >
                          Resolve
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Reviewed {report.reviewedAt ? new Date(report.reviewedAt).toLocaleString() : "recently"}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
