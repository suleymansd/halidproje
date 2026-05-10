"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  ApiError,
  RelationshipState,
  UserPresence,
  UserProfile,
  blockUser,
  followUser,
  getCurrentUser,
  getRelationshipState,
  getUserById,
  getUserPresence,
  respondToFriendRequest,
  sendFriendRequest,
  startDirectMessage,
  unblockUser,
  unfollowUser
} from "../../../lib/api";
import { clearAccessToken, getAccessToken } from "../../../lib/auth";
import { NotificationBell } from "../../../components/notification-bell";

type UserProfilePageProps = {
  params: {
    id: string;
  };
};

const BLOCKED_DM_MESSAGE = "Direct messages are disabled between blocked users.";

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const router = useRouter();
  const [viewer, setViewer] = useState<UserProfile | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [relationship, setRelationship] = useState<RelationshipState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingDm, setStartingDm] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);
  const [presence, setPresence] = useState<UserPresence | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialFeedback, setSocialFeedback] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }

    void bootstrap();
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

  async function bootstrap() {
    setLoading(true);
    setError(null);
    try {
      const [me, targetProfile, targetPresence] = await Promise.all([
        getCurrentUser(),
        getUserById(params.id),
        getUserPresence(params.id).catch(() => null)
      ]);
      setViewer(me);
      setProfile(targetProfile);
      setPresence(targetPresence);

      if (me.id !== params.id) {
        const social = await getRelationshipState(params.id);
        setRelationship(social);
      } else {
        setRelationship({
          targetUserId: params.id,
          isSelf: true,
          friendshipStatus: "none",
          friendRequestId: null,
          isFollowing: false,
          isFollowedBy: false,
          isBlocked: false,
          isBlockedBy: false,
          followersCount: 0,
          followingCount: 0
        });
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err instanceof Error ? err.message : "Failed to load user profile.");
    } finally {
      setLoading(false);
    }
  }

  function handleAuthError(err: unknown) {
    const message =
      err instanceof ApiError
        ? `${err.status}:${err.message}`
        : err instanceof Error
          ? err.message
          : "";
    if (message.includes("401") || message.includes("Unauthorized") || message.includes("NO_TOKEN")) {
      clearAccessToken();
      router.replace("/");
      return true;
    }
    return false;
  }

  async function refreshRelationship() {
    if (!viewer || !profile || viewer.id === profile.id) {
      return;
    }

    const social = await getRelationshipState(profile.id);
    setRelationship(social);
  }

  async function runSocialAction(action: () => Promise<unknown>, successMessage: string) {
    setSocialLoading(true);
    setError(null);
    setDmError(null);
    setSocialFeedback(null);
    try {
      await action();
      await refreshRelationship();
      setSocialFeedback(successMessage);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err instanceof Error ? err.message : "Social action failed.");
    } finally {
      setSocialLoading(false);
    }
  }

  async function onStartMessage() {
    if (!profile || relationship?.isBlocked || relationship?.isBlockedBy) {
      setDmError(BLOCKED_DM_MESSAGE);
      return;
    }
    setStartingDm(true);
    setDmError(null);
    try {
      const dm = await startDirectMessage(profile.id);
      router.push(`/chat?roomId=${dm.roomId}`);
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err instanceof ApiError && err.status === 403) {
        setDmError(BLOCKED_DM_MESSAGE);
      } else {
        setDmError(err instanceof Error ? err.message : "Failed to start direct message.");
      }
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

  function friendshipLabel() {
    switch (relationship?.friendshipStatus) {
      case "friends":
        return "Friends";
      case "incoming_request":
        return "Incoming friend request";
      case "outgoing_request":
        return "Friend request sent";
      default:
        return "Not connected";
    }
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
            <Link href="/friends" className="rounded-md px-2 py-1 hover:bg-slate-800">
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
                {profile.bio ? <p className="mt-3 text-sm text-slate-400">{profile.bio}</p> : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
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
                    {presence?.status === "online" ? "Online" : formatLastSeen(presence?.lastSeen)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                  <p>
                    <span className="text-slate-400">Followers:</span>{" "}
                    {relationship?.followersCount ?? 0}
                  </p>
                  <p className="mt-1">
                    <span className="text-slate-400">Following:</span>{" "}
                    {relationship?.followingCount ?? 0}
                  </p>
                  <p className="mt-1">
                    <span className="text-slate-400">Friendship:</span> {friendshipLabel()}
                  </p>
                </div>
              </div>

              {socialFeedback ? <p className="text-sm text-emerald-400">{socialFeedback}</p> : null}
              {dmError ? <p className="text-sm text-rose-400">{dmError}</p> : null}

              {!relationship?.isSelf ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={onStartMessage}
                    disabled={startingDm || Boolean(relationship?.isBlocked || relationship?.isBlockedBy)}
                    className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {startingDm ? "Starting..." : "Message"}
                  </button>

                  {relationship?.friendshipStatus === "none" ? (
                    <button
                      onClick={() =>
                        runSocialAction(
                          () => sendFriendRequest(profile.id),
                          "Friend request sent."
                        )
                      }
                      disabled={socialLoading || Boolean(relationship?.isBlocked || relationship?.isBlockedBy)}
                      className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-70"
                    >
                      Add Friend
                    </button>
                  ) : null}

                  {relationship?.friendshipStatus === "incoming_request" && relationship.friendRequestId ? (
                    <>
                      <button
                        onClick={() =>
                          runSocialAction(
                            () => respondToFriendRequest(relationship.friendRequestId!, "accept"),
                            "Friend request accepted."
                          )
                        }
                        disabled={socialLoading}
                        className="rounded-md border border-emerald-700 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-70"
                      >
                        Accept Friend
                      </button>
                      <button
                        onClick={() =>
                          runSocialAction(
                            () => respondToFriendRequest(relationship.friendRequestId!, "reject"),
                            "Friend request rejected."
                          )
                        }
                        disabled={socialLoading}
                        className="rounded-md border border-rose-700 px-4 py-2 text-sm text-rose-300 hover:bg-rose-900/30 disabled:opacity-70"
                      >
                        Reject
                      </button>
                    </>
                  ) : null}

                  {relationship?.isFollowing ? (
                    <button
                      onClick={() =>
                        runSocialAction(() => unfollowUser(profile.id), "User unfollowed.")
                      }
                      disabled={socialLoading}
                      className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-70"
                    >
                      Unfollow
                    </button>
                  ) : (
                    <button
                      onClick={() => runSocialAction(() => followUser(profile.id), "Now following user.")}
                      disabled={socialLoading || Boolean(relationship?.isBlocked || relationship?.isBlockedBy)}
                      className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-70"
                    >
                      Follow
                    </button>
                  )}

                  {relationship?.isBlocked ? (
                    <button
                      onClick={() => runSocialAction(() => unblockUser(profile.id), "User unblocked.")}
                      disabled={socialLoading}
                      className="rounded-md border border-amber-700 px-4 py-2 text-sm text-amber-300 hover:bg-amber-900/30 disabled:opacity-70"
                    >
                      Unblock
                    </button>
                  ) : (
                    <button
                      onClick={() => runSocialAction(() => blockUser(profile.id), "User blocked.")}
                      disabled={socialLoading}
                      className="rounded-md border border-rose-700 px-4 py-2 text-sm text-rose-300 hover:bg-rose-900/30 disabled:opacity-70"
                    >
                      Block
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
