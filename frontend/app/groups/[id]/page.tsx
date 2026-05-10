"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GroupDetail, getGroupById } from "../../../lib/api";
import { clearAccessToken, getAccessToken } from "../../../lib/auth";
import { NotificationBell } from "../../../components/notification-bell";

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }

    void loadGroup();
  }, [params.id, router]);

  async function loadGroup() {
    setLoading(true);
    setError(null);
    try {
      setGroup(await getGroupById(params.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load group.";
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
      <div className="mx-auto max-w-4xl">
        <header className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/chat" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Chat
            </Link>
            <Link href="/groups" className="rounded-md bg-slate-800 px-2 py-1 text-cyan-300">
              Groups
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
          <p className="text-sm text-slate-400">Loading group...</p>
        ) : error ? (
          <p className="text-sm text-rose-400">{error}</p>
        ) : !group ? (
          <p className="text-sm text-slate-400">Group not found.</p>
        ) : (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold">{group.name}</h1>
                  <p className="mt-2 text-sm text-slate-400">{group.description || "No description."}</p>
                </div>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase text-slate-400">
                  {group.visibility ?? "public"}
                </span>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <span>Owner: {group.owner?.fullName || group.owner?.username || "Unknown"}</span>
                <span>Members: {group.memberCount ?? group.members?.length ?? 0}</span>
              </div>

              {group.roomId ? (
                <button
                  onClick={() => router.push(`/chat?roomId=${group.roomId}`)}
                  className="mt-4 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
                >
                  Open Group Chat
                </button>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No linked chat room yet.</p>
              )}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-3 text-lg font-semibold">Members</h2>
              {!group.members?.length ? (
                <p className="text-sm text-slate-400">No active members listed.</p>
              ) : (
                <div className="space-y-3">
                  {group.members.map((member) => (
                    <Link
                      key={member.id}
                      href={`/users/${member.id}`}
                      className="block rounded-lg border border-slate-800 bg-slate-950 p-3 hover:border-slate-700"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{member.fullName || member.username || member.email}</p>
                          <p className="text-sm text-slate-400">
                            {member.username ? `@${member.username}` : member.email}
                          </p>
                        </div>
                        <span className="text-xs uppercase text-slate-500">{member.roomRole || "member"}</span>
                      </div>
                    </Link>
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
