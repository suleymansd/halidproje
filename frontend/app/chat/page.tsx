"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChatMessage,
  ChatRoom,
  getUserPresence,
  getMessages,
  getRooms,
  markRoomAsRead,
  sendMessage
} from "../../lib/api";
import { clearAccessToken, getAccessToken } from "../../lib/auth";
import { io, Socket } from "socket.io-client";
import { NotificationBell } from "../../components/notification-bell";

type TypingUpdatedPayload = {
  roomId: string;
  userId: string;
  isTyping: boolean;
  userName: string;
};

type PresencePayload = {
  userId: string;
  status: "online" | "offline";
  lastSeen: string;
};

export default function ChatPage() {
  const router = useRouter();
  const initialRoomIdRef = useRef<string | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [presenceMap, setPresenceMap] = useState<Record<string, PresencePayload>>({});
  const socketRef = useRef<Socket | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const selectedRoomRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }

    if (typeof window !== "undefined") {
      initialRoomIdRef.current = new URLSearchParams(window.location.search).get("roomId");
    }

    void loadRooms();
  }, [router]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      return;
    }

    const socket = io("http://localhost:3002/chat", {
      auth: {
        token: `Bearer ${token}`
      }
    });

    socket.on("message.created", (incoming: ChatMessage) => {
      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== incoming.roomId) return room;

          const isActive = selectedRoomRef.current === room.id;
          const senderName =
            incoming.sender?.fullName || incoming.sender?.username || "Unknown";
          const sameAsCurrentLastMessage = room.lastMessage?.id === incoming.id;
          const nextUnreadCount = isActive
            ? 0
            : sameAsCurrentLastMessage
              ? room.unreadCount ?? 0
              : (room.unreadCount ?? 0) + 1;

          return {
            ...room,
            unreadCount: nextUnreadCount,
            lastMessage: {
              id: incoming.id,
              content: incoming.content,
              senderId: incoming.senderId,
              senderName,
              createdAt: incoming.createdAt
            }
          };
        })
      );

      const currentRoomId = selectedRoomRef.current;
      if (!currentRoomId || incoming.roomId !== currentRoomId) {
        return;
      }

      setMessages((prev) => {
        if (prev.some((message) => message.id === incoming.id)) {
          return prev;
        }
        return [...prev, incoming];
      });
    });

    socket.on("typing.updated", (payload: TypingUpdatedPayload) => {
      if (payload.roomId !== selectedRoomRef.current) {
        return;
      }

      setTypingUsers((prev) => {
        const next = { ...prev };
        if (payload.isTyping) {
          next[payload.userId] = payload.userName;
        } else {
          delete next[payload.userId];
        }
        return next;
      });
    });

    socket.on("presence.updated", (payload: PresencePayload) => {
      setPresenceMap((prev) => ({
        ...prev,
        [payload.userId]: payload
      }));
    });

    socketRef.current = socket;

    return () => {
      joinedRoomsRef.current.clear();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || rooms.length === 0) return;

    const activeJoinedRooms = joinedRoomsRef.current;
    const roomIds = new Set(rooms.map((room) => room.id));

    for (const roomId of roomIds) {
      if (!activeJoinedRooms.has(roomId)) {
        socket.emit("room.join", { roomId });
        activeJoinedRooms.add(roomId);
      }
    }

    for (const joinedRoomId of [...activeJoinedRooms]) {
      if (!roomIds.has(joinedRoomId)) {
        socket.emit("room.leave", { roomId: joinedRoomId });
        activeJoinedRooms.delete(joinedRoomId);
      }
    }
  }, [rooms]);

  useEffect(() => {
    if (!selectedRoomId) return;
    const previousSelectedRoomId = selectedRoomRef.current;
    selectedRoomRef.current = selectedRoomId;
    setTypingUsers({});

    if (socketRef.current) {
      if (previousSelectedRoomId && previousSelectedRoomId !== selectedRoomId) {
        socketRef.current.emit("typing.stop", { roomId: previousSelectedRoomId });
      }
    }

    stopTyping();
    void loadMessages(selectedRoomId);
  }, [selectedRoomId]);

  useEffect(() => {
    const activeRoom = rooms.find((room) => room.id === selectedRoomId);
    const counterpartId = activeRoom?.counterpartUser?.id;
    if (!counterpartId) return;

    void loadPresence(counterpartId);
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const typingLabel = useMemo(() => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    return `${names[0]} and ${names.length - 1} others are typing`;
  }, [typingUsers]);

  async function loadRooms() {
    setRoomsLoading(true);
    setError(null);
    try {
      const data = await getRooms();
      setRooms(data);
      if (data.length > 0) {
        const requestedRoomId =
          initialRoomIdRef.current &&
          data.some((room) => room.id === initialRoomIdRef.current)
            ? initialRoomIdRef.current
            : null;

        setSelectedRoomId((prev) => {
          if (requestedRoomId) {
            return requestedRoomId;
          }
          if (prev && data.some((room) => room.id === prev)) {
            return prev;
          }
          return data[0].id;
        });
      }
    } catch {
      setError("Failed to load rooms.");
    } finally {
      setRoomsLoading(false);
    }
  }

  async function loadMessages(roomId: string) {
    setMessagesLoading(true);
    setError(null);
    try {
      const data = await getMessages(roomId);
      setMessages(data.items);
      const lastMessage = data.items[data.items.length - 1];
      if (lastMessage?.id) {
        await markRoomAsRead(roomId, lastMessage.id);
      }
      setRooms((prev) =>
        prev.map((room) => (room.id === roomId ? { ...room, unreadCount: 0 } : room))
      );
    } catch {
      setError("Failed to load messages.");
    } finally {
      setMessagesLoading(false);
    }
  }

  async function loadPresence(userId: string) {
    try {
      const presence = await getUserPresence(userId);
      setPresenceMap((prev) => ({
        ...prev,
        [presence.userId]: presence
      }));
    } catch {
      // no-op
    }
  }

  function scheduleTypingStop() {
    if (!socketRef.current || !selectedRoomRef.current) return;

    if (!isTypingRef.current) {
      socketRef.current.emit("typing.start", { roomId: selectedRoomRef.current });
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  }

  function stopTyping() {
    if (!socketRef.current || !selectedRoomRef.current) return;
    if (!isTypingRef.current) return;

    socketRef.current.emit("typing.stop", { roomId: selectedRoomRef.current });
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }

  function onInputChange(value: string) {
    setMessageInput(value);
    if (!value.trim()) {
      stopTyping();
      return;
    }
    scheduleTypingStop();
  }

  async function onSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoomId || !messageInput.trim()) return;

    setSending(true);
    setError(null);
    try {
      await sendMessage({
        roomId: selectedRoomId,
        content: messageInput.trim()
      });
      setMessageInput("");
      stopTyping();
      await loadMessages(selectedRoomId);
    } catch {
      setError("Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  function formatTime(value?: string) {
    if (!value) return "";
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
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

  function renderPresence() {
    const counterpartId = selectedRoom?.counterpartUser?.id;
    if (!counterpartId) return null;

    const presence = presenceMap[counterpartId];
    if (!presence) {
      return <p className="mt-1 text-xs text-slate-400">Presence unavailable</p>;
    }

    if (presence.status === "online") {
      return (
        <p className="mt-1 flex items-center gap-2 text-xs text-emerald-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Online
        </p>
      );
    }

    return <p className="mt-1 text-xs text-slate-400">{formatLastSeen(presence.lastSeen)}</p>;
  }

  function logout() {
    stopTyping();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    clearAccessToken();
    router.replace("/");
  }

  return (
    <main className="h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid h-full max-w-7xl grid-cols-1 md:grid-cols-[320px_1fr]">
        <aside className="border-b border-slate-800 bg-slate-900 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <h1 className="mr-2 text-lg font-semibold">IsuChat</h1>
              <Link href="/chat" className="rounded-md bg-slate-800 px-2 py-1 text-cyan-300">
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
                className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
              >
                Logout
              </button>
            </div>
          </div>
          <div className="h-[260px] overflow-y-auto md:h-[calc(100vh-57px)]">
            {roomsLoading ? (
              <p className="p-4 text-sm text-slate-400">Loading rooms...</p>
            ) : rooms.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">No rooms found.</p>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={`w-full border-b border-slate-800 px-4 py-3 text-left hover:bg-slate-800 ${
                    selectedRoomId === room.id ? "bg-slate-800" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {room.name || `Room ${room.id.slice(0, 8)}`}
                    </p>
                    {room.unreadCount && room.unreadCount > 0 ? (
                      <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-[11px] font-semibold text-slate-950">
                        {room.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    {room.lastMessage?.content || room.roomType || "No messages yet"}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex h-full flex-col">
          <header className="border-b border-slate-800 px-4 py-3">
            <h2 className="truncate font-medium">
              {selectedRoom?.name || "Select a room"}
            </h2>
            {selectedRoom?.roomType === "private" ? renderPresence() : null}
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messagesLoading ? (
              <p className="text-sm text-slate-400">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-slate-400">No messages yet.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-3"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span>
                        {message.sender?.fullName ||
                          message.sender?.username ||
                          "Unknown"}
                      </span>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                    <p className="text-sm leading-6">{message.content || "[deleted]"}</p>
                  </article>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <form
            onSubmit={onSendMessage}
            className="border-t border-slate-800 bg-slate-900 p-3"
          >
            {typingLabel ? (
              <p className="mb-2 text-xs text-slate-400">{typingLabel}</p>
            ) : null}
            {error ? <p className="mb-2 text-xs text-rose-400">{error}</p> : null}
            <div className="flex gap-2">
              <input
                value={messageInput}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
              />
              <button
                type="submit"
                disabled={sending || !selectedRoomId}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
