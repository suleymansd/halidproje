"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FriendsResponse, getFriends, respondToFriendRequest } from "../../lib/api";
import { clearAccessToken, getAccessToken } from "../../lib/auth";
import { NotificationBell } from "../../components/notification-bell";

export default function FriendsPage() {
  const router = useRouter();
  const [data, setData] = useState<FriendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }

    void loadFriends();
  }, [router]);

  async function loadFriends() {
    setLoading(true);
    setError(null);
    try {
      setData(await getFriends());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load friends.";
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

  async function onRespond(requestId: string, action: "accept" | "reject") {
    setActionLoading(`${requestId}:${action}`);
    setError(null);
    try {
      await respondToFriendRequest(requestId, action);
      await loadFriends();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Friend action failed.");
    } finally {
      setActionLoading(null);
    }
  }

  function logout() {
    clearAccessToken();
    router.replace("/");
  }

  const friends = data?.friends ?? [];
  const incoming = data?.incomingRequests ?? [];
  const outgoing = data?.outgoingRequests ?? [];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/chat" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Chat
            </Link>
            <Link href="/friends" className="rounded-md bg-slate-800 px-2 py-1 text-cyan-300">
              Friends
            </Link>
            <Link href="/following" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Following
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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 text-lg font-semibold">Friends</h2>
            {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            {!loading && friends.length === 0 ? (
              <p className="text-sm text-slate-400">No friends yet.</p>
            ) : (
              <div className="space-y-3">
                {friends.map((item) => (
                  <Link
                    key={item.requestId}
                    href={`/users/${item.user.id}`}
                    className="block rounded-lg border border-slate-800 bg-slate-950 p-3 hover:border-slate-700"
                  >
                    <p className="font-medium">{item.user.fullName}</p>
                    <p className="text-sm text-slate-400">
                      {item.user.username ? `@${item.user.username}` : item.user.email}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 text-lg font-semibold">Incoming Requests</h2>
            {!loading && incoming.length === 0 ? (
              <p className="text-sm text-slate-400">No incoming requests.</p>
            ) : (
              <div className="space-y-3">
                {incoming.map((item) => (
                  <div
                    key={item.requestId}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                  >
                    <Link href={`/users/${item.user.id}`} className="block">
                      <p className="font-medium">{item.user.fullName}</p>
                      <p className="text-sm text-slate-400">
                        {item.user.username ? `@${item.user.username}` : item.user.email}
                      </p>
                    </Link>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => onRespond(item.requestId, "accept")}
                        disabled={actionLoading === `${item.requestId}:accept`}
                        className="rounded-md border border-emerald-700 px-3 py-1 text-sm text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-70"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => onRespond(item.requestId, "reject")}
                        disabled={actionLoading === `${item.requestId}:reject`}
                        className="rounded-md border border-rose-700 px-3 py-1 text-sm text-rose-300 hover:bg-rose-900/30 disabled:opacity-70"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 text-lg font-semibold">Outgoing Requests</h2>
            {!loading && outgoing.length === 0 ? (
              <p className="text-sm text-slate-400">No outgoing requests.</p>
            ) : (
              <div className="space-y-3">
                {outgoing.map((item) => (
                  <Link
                    key={item.requestId}
                    href={`/users/${item.user.id}`}
                    className="block rounded-lg border border-slate-800 bg-slate-950 p-3 hover:border-slate-700"
                  >
                    <p className="font-medium">{item.user.fullName}</p>
                    <p className="text-sm text-slate-400">
                      {item.user.username ? `@${item.user.username}` : item.user.email}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
