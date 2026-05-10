"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BlocksResponse, FollowsResponse, getBlocks, getFollows, unblockUser, unfollowUser } from "../../lib/api";
import { clearAccessToken, getAccessToken } from "../../lib/auth";
import { NotificationBell } from "../../components/notification-bell";

export default function FollowingPage() {
  const router = useRouter();
  const [follows, setFollows] = useState<FollowsResponse | null>(null);
  const [blocks, setBlocks] = useState<BlocksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }

    void loadData();
  }, [router]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [followsResponse, blocksResponse] = await Promise.all([getFollows(), getBlocks()]);
      setFollows(followsResponse);
      setBlocks(blocksResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load follows.";
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

  async function onUnfollow(userId: string) {
    setActionLoading(`unfollow:${userId}`);
    setError(null);
    try {
      await unfollowUser(userId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unfollow failed.");
    } finally {
      setActionLoading(null);
    }
  }

  async function onUnblock(userId: string) {
    setActionLoading(`unblock:${userId}`);
    setError(null);
    try {
      await unblockUser(userId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unblock failed.");
    } finally {
      setActionLoading(null);
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
            <Link href="/chat" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Chat
            </Link>
            <Link href="/friends" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Friends
            </Link>
            <Link href="/following" className="rounded-md bg-slate-800 px-2 py-1 text-cyan-300">
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

        {error ? <p className="mb-4 text-sm text-rose-400">{error}</p> : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 md:col-span-2">
            <h2 className="mb-3 text-lg font-semibold">Following</h2>
            {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}
            {!loading && (follows?.following?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-400">You are not following anyone yet.</p>
            ) : (
              <div className="space-y-3">
                {follows?.following.map((item) => (
                  <div
                    key={item.user.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3"
                  >
                    <Link href={`/users/${item.user.id}`} className="block">
                      <p className="font-medium">{item.user.fullName}</p>
                      <p className="text-sm text-slate-400">
                        {item.user.username ? `@${item.user.username}` : item.user.email}
                      </p>
                    </Link>
                    <button
                      onClick={() => onUnfollow(item.user.id)}
                      disabled={actionLoading === `unfollow:${item.user.id}`}
                      className="rounded-md border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800 disabled:opacity-70"
                    >
                      Unfollow
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 text-lg font-semibold">Followers</h2>
            {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}
            {!loading && (follows?.followers?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-400">No followers yet.</p>
            ) : (
              <div className="space-y-3">
                {follows?.followers.map((item) => (
                  <Link
                    key={item.user.id}
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

        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 text-lg font-semibold">Blocked Users</h2>
          {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}
          {!loading && (blocks?.items?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400">No blocked users.</p>
          ) : (
            <div className="space-y-3">
              {blocks?.items.map((item) => (
                <div
                  key={item.user.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3"
                >
                  <Link href={`/users/${item.user.id}`} className="block">
                    <p className="font-medium">{item.user.fullName}</p>
                    <p className="text-sm text-slate-400">
                      {item.user.username ? `@${item.user.username}` : item.user.email}
                    </p>
                  </Link>
                  <button
                    onClick={() => onUnblock(item.user.id)}
                    disabled={actionLoading === `unblock:${item.user.id}`}
                    className="rounded-md border border-amber-700 px-3 py-1 text-sm text-amber-300 hover:bg-amber-900/30 disabled:opacity-70"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
