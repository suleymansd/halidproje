"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  getUserById,
  getUserPresence,
  startDirectMessage,
  UserPresence,
  UserProfile
} from "../../../lib/api";
import { clearAccessToken, getAccessToken } from "../../../lib/auth";
import { NotificationBell } from "../../../components/notification-bell";

type UserProfilePageProps = {
  params: {
    id: string;
  };
};

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingDm, setStartingDm] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);
  const [presence, setPresence] = useState<UserPresence | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }

    void loadProfile();
    void loadPresence();
  }, [params.id, router]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const socket: Socket = io("http://localhost:3002/chat", {
      auth: {
        token: `Bearer ${token}`
      }
    });

    socket.on("presence.updated", (payload: UserPresence) => {
      if (payload.userId !== params.id) return;
      setPresence(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [params.id]);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const data = await getUserById(params.id);
      setProfile(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load user profile.";
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

  async function loadPresence() {
    try {
      const data = await getUserPresence(params.id);
      setPresence(data);
    } catch {
      // no-op
    }
  }

  async function onStartMessage() {
    if (!profile) return;
    setStartingDm(true);
    setDmError(null);
    try {
      const dm = await startDirectMessage(profile.id);
      router.push(`/chat?roomId=${dm.roomId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start direct message.";
      if (message.includes("401") || message.includes("Unauthorized") || message.includes("NO_TOKEN")) {
        clearAccessToken();
        router.replace("/");
        return;
      }
      setDmError(message);
    } finally {
      setStartingDm(false);
    }
  }

  function logout() {
    clearAccessToken();
    router.replace("/");
  }

  function formatLastSeen(value?: string) {
    if (!value) return "Last seen recently";
    const diffMs = Date.now() - new Date(value).getTime();
    if (diffMs < 60_000) return "Last seen just now";
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 60) return `Last seen ${diffMin} min ago`;
    const diffHour = Math.floor(diffMin / 60);
    return `Last seen ${diffHour} hour ago`;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-4">
        <header className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/chat" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Chat
            </Link>
            <Link href="/materials" className="rounded-md px-2 py-1 hover:bg-slate-800">
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

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          {loading ? <p className="text-sm text-slate-400">Loading profile...</p> : null}
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          {!loading && !error && profile ? (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold">{profile.fullName}</h1>
                <p className="mt-1 text-sm text-slate-300">
                  {profile.username ? `@${profile.username}` : profile.email}
                </p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                <p>
                  <span className="text-slate-400">Email:</span> {profile.email}
                </p>
                <p className="mt-1">
                  <span className="text-slate-400">Department:</span>{" "}
                  {profile.department?.name ?? "Not assigned"}
                </p>
                <p className="mt-1">
                  <span className="text-slate-400">Status:</span>{" "}
                  {presence?.status === "online"
                    ? "Online"
                    : formatLastSeen(presence?.lastSeen)}
                </p>
              </div>

              {dmError ? <p className="text-sm text-rose-400">{dmError}</p> : null}

              <button
                onClick={onStartMessage}
                disabled={startingDm}
                className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {startingDm ? "Starting..." : "Message"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
