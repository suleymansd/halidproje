"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminToolsOverview, AuditLogEvent, UserProfile, getAdminToolsOverview, getAuditLogs, getCurrentUser } from "../../../lib/api";
import { clearAccessToken, getAccessToken } from "../../../lib/auth";
import { NotificationBell } from "../../../components/notification-bell";

function canAccessAdmin(role?: string) {
  return role === "school_admin" || role === "moderator";
}

export default function AdminToolsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [overview, setOverview] = useState<AdminToolsOverview | null>(null);
  const [logs, setLogs] = useState<AuditLogEvent[]>([]);
  const [loading, setLoading] = useState(true);
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

      const [overviewData, logData] = await Promise.all([getAdminToolsOverview(), getAuditLogs(40)]);
      setOverview(overviewData);
      setLogs(logData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load admin tools.";
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

  if (!loading && profile && !canAccessAdmin(profile.role)) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h1 className="text-xl font-semibold">Admin Access Required</h1>
          <p className="mt-2 text-sm text-slate-400">This page is restricted to moderators and school admins.</p>
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
            <Link href="/admin" className="rounded-md px-2 py-1 hover:bg-slate-800">Moderation</Link>
            <Link href="/admin/tools" className="rounded-md bg-slate-800 px-2 py-1 text-cyan-300">Admin Tools</Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={logout} className="rounded-md border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800">
              Logout
            </button>
          </div>
        </header>

        {loading ? <p className="text-sm text-slate-400">Loading admin tools...</p> : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {!loading && !error && overview ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-lg font-semibold">Recent Registrations</h2>
              <div className="mt-3 space-y-3">
                {overview.recentRegistrations.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="font-medium">{item.fullName}</p>
                    <p className="mt-1 text-sm text-slate-400">{item.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.role}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-lg font-semibold">Recent Reports</h2>
              <div className="mt-3 space-y-3">
                {overview.recentReports.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="font-medium">{item.referenceType} report</p>
                    <p className="mt-1 text-sm text-slate-400">{item.status}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-lg font-semibold">Recent Material Uploads</h2>
              <div className="mt-3 space-y-3">
                {overview.recentMaterialUploads.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{item.uploaderName}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 lg:col-span-3">
              <h2 className="text-lg font-semibold">Audit Logs</h2>
              <div className="mt-3 space-y-3">
                {logs.length === 0 ? (
                  <p className="text-sm text-slate-400">No audit events available.</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={`${log.actionType}-${log.occurredAt}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{log.actionType}</p>
                        <p className="text-xs text-slate-500">{new Date(log.occurredAt).toLocaleString()}</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{log.actorName || log.actorEmail || log.userId || "Unknown actor"}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
