"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
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

type NormalizedMessage = ChatMessage & {
  normalizedSenderId: string | null;
  normalizedSenderName: string;
  isSelf: boolean;
};

function decodeTokenPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getCurrentUserIdFromToken(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const payload = decodeTokenPayload(token);
  const subject = payload?.sub;
  return typeof subject === "string" ? subject : null;
}

function getSenderId(message: ChatMessage): string | null {
  const candidateIds = [
    message.senderId,
    message.sender?.id,
    message.user?.id,
    message.author?.id
  ];

  for (const value of candidateIds) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function getSenderName(message: ChatMessage): string {
  const candidateNames = [
    message.senderName,
    message.sender?.fullName,
    message.sender?.username,
    message.sender?.name,
    message.user?.fullName,
    message.user?.username,
    message.user?.name,
    message.author?.fullName,
    message.author?.username,
    message.author?.name
  ];

  for (const value of candidateNames) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "Unknown User";
}

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "U";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
}

function normalizeMessage(message: ChatMessage, currentUserId: string | null): NormalizedMessage {
  const normalizedSenderId = getSenderId(message);
  return {
    ...message,
    normalizedSenderId,
    normalizedSenderName: getSenderName(message),
    isSelf: Boolean(currentUserId && normalizedSenderId && currentUserId === normalizedSenderId)
  };
}

function getRoomTitle(room: ChatRoom): string {
  if (room.name?.trim()) {
    return room.name.trim();
  }

  if (room.roomType === "private") {
    const counterpartName =
      room.counterpartUser?.fullName?.trim() || room.counterpartUser?.username?.trim();
    if (counterpartName) {
      return counterpartName;
    }
  }

  return `Room ${room.id.slice(0, 8)}`;
}

function getRoomTypeLabel(roomType?: string): string {
  switch (roomType) {
    case "private":
      return "Direct Message";
    case "general":
      return "General Room";
    case "department":
      return "Department Room";
    case "group":
      return "Group Room";
    default:
      return "Chat Room";
  }
}

function getLastMessagePreview(room: ChatRoom, currentUserId: string | null): string {
  const content = room.lastMessage?.content?.trim();
  if (!content) {
    return room.roomType === "private"
      ? "Start the conversation"
      : `No messages in this ${getRoomTypeLabel(room.roomType).toLowerCase()}`;
  }

  const senderId = room.lastMessage?.senderId;
  const senderName = room.lastMessage?.senderName?.trim() || "Unknown User";
  const isSelf = Boolean(currentUserId && senderId && senderId === currentUserId);
  const prefix = isSelf ? "You" : senderName;

  if (room.roomType === "private") {
    return isSelf ? `You: ${content}` : content;
  }

  return `${prefix}: ${content}`;
}

export default function ChatPage() {
  const router = useRouter();
  const initialRoomIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
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

    currentUserIdRef.current = getCurrentUserIdFromToken(token);

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

    socket.on("connect_error", () => {
      clearAccessToken();
      router.replace("/");
    });

    socket.on("message.created", (incoming: ChatMessage) => {
      const normalizedIncoming = normalizeMessage(incoming, currentUserIdRef.current);

      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== incoming.roomId) return room;

          const isActive = selectedRoomRef.current === room.id;
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
              senderId: normalizedIncoming.normalizedSenderId ?? undefined,
              senderName: normalizedIncoming.normalizedSenderName,
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
  }, [router]);

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

    if (socketRef.current && previousSelectedRoomId && previousSelectedRoomId !== selectedRoomId) {
      socketRef.current.emit("typing.stop", { roomId: previousSelectedRoomId });
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

  const normalizedMessages = useMemo(
    () => messages.map((message) => normalizeMessage(message, currentUserIdRef.current)),
    [messages]
  );

  const typingLabel = useMemo(() => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]} and ${names.length - 1} others are typing...`;
  }, [typingUsers]);

  function isAuthError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : "";
    const status = err instanceof ApiError ? err.status : undefined;
    return status === 401 || message.includes("NO_TOKEN") || message.includes("Unauthorized");
  }

  function handleAuthError(err: unknown): boolean {
    if (!isAuthError(err)) {
      return false;
    }

    stopTyping();
    clearAccessToken();
    router.replace("/");
    return true;
  }

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
    } catch (err) {
      if (handleAuthError(err)) {
        return;
      }
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
    } catch (err) {
      if (handleAuthError(err)) {
        return;
      }
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
    } catch (err) {
      if (handleAuthError(err)) {
        return;
      }
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
    } catch (err) {
      if (handleAuthError(err)) {
        return;
      }
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
      return <p className="text-xs text-slate-400">Presence unavailable</p>;
    }

    if (presence.status === "online") {
      return (
        <p className="flex items-center gap-2 text-xs text-emerald-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Online
        </p>
      );
    }

    return <p className="text-xs text-slate-400">{formatLastSeen(presence.lastSeen)}</p>;
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
    <main className="chat-scene relative h-screen overflow-hidden text-slate-100">
      <div className="chat-pattern pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid h-full max-w-7xl grid-cols-1 gap-0 md:grid-cols-[340px_1fr] md:p-4">
        <aside className="flex h-full flex-col border-b border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.94)] md:rounded-l-3xl md:border md:border-r-0">
          <div className="border-b border-[rgba(127,183,220,0.16)] px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#7fb7dc]">IsuChat</p>
                <h1 className="mt-1 text-xl font-semibold text-white">Conversations</h1>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell />
                <button
                  onClick={logout}
                  className="rounded-full border border-[rgba(127,183,220,0.2)] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-[rgba(127,183,220,0.38)] hover:bg-[rgba(56,128,176,0.12)]"
                >
                  Logout
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Link href="/chat" className="rounded-full bg-[#3880b0] px-3 py-1.5 font-medium text-[#08131d]">
                Chat
              </Link>
              <Link
                href="/materials"
                className="rounded-full border border-[rgba(127,183,220,0.2)] px-3 py-1.5 text-slate-300 transition hover:bg-[rgba(56,128,176,0.12)]"
              >
                Materials
              </Link>
              <Link
                href="/search"
                className="rounded-full border border-[rgba(127,183,220,0.2)] px-3 py-1.5 text-slate-300 transition hover:bg-[rgba(56,128,176,0.12)]"
              >
                Search
              </Link>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {roomsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={`room-skeleton-${index}`}
                    className="animate-pulse rounded-2xl border border-[rgba(127,183,220,0.12)] bg-[rgba(8,19,29,0.76)] p-4"
                  >
                    <div className="h-4 w-2/3 rounded bg-slate-800" />
                    <div className="mt-3 h-3 w-full rounded bg-slate-800" />
                  </div>
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <div className="flex h-full min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-[rgba(127,183,220,0.18)] bg-[rgba(8,19,29,0.52)] px-6 text-center">
                <div>
                  <p className="text-sm font-medium text-slate-200">No rooms available yet</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Rooms will appear here once messaging is available for your account.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((room) => {
                  const isActive = selectedRoomId === room.id;
                  const roomName = getRoomTitle(room);
                  const roomTypeLabel = getRoomTypeLabel(room.roomType);
                  const preview = getLastMessagePreview(room, currentUserIdRef.current);

                  return (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-[rgba(127,183,220,0.4)] bg-[rgba(56,128,176,0.14)] shadow-[0_0_0_1px_rgba(56,128,176,0.16)]"
                          : "border-[rgba(127,183,220,0.12)] bg-[rgba(8,19,29,0.52)] hover:border-[rgba(127,183,220,0.24)] hover:bg-[rgba(8,19,29,0.76)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-100">{roomName}</p>
                            <span className="rounded-full border border-[rgba(127,183,220,0.18)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                              {roomTypeLabel}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-sm text-slate-400">{preview}</p>
                        </div>
                        {room.unreadCount && room.unreadCount > 0 ? (
                          <span className="mt-0.5 inline-flex min-w-6 items-center justify-center rounded-full bg-[#3880b0] px-2 py-1 text-[11px] font-bold text-[#08131d]">
                            {room.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="flex h-full min-h-0 flex-col bg-[rgba(8,19,29,0.82)] md:rounded-r-3xl md:border md:border-[rgba(127,183,220,0.16)]">
          <header className="border-b border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.72)] px-4 py-4 backdrop-blur">
            {selectedRoom ? (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-white">
                      {getRoomTitle(selectedRoom)}
                    </h2>
                    <span className="rounded-full border border-[rgba(127,183,220,0.18)] px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {getRoomTypeLabel(selectedRoom.roomType)}
                    </span>
                  </div>
                  <div className="mt-2">
                    {selectedRoom.roomType === "private" ? (
                      renderPresence()
                    ) : (
                      <p className="text-xs text-slate-400">
                        Live room for {getRoomTypeLabel(selectedRoom.roomType).toLowerCase()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-semibold text-white">Select a conversation</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Choose a room from the left to start reading and sending messages.
                </p>
              </div>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(56,128,176,0.12),_transparent_32%),linear-gradient(180deg,_rgba(15,29,43,0.92),_rgba(8,19,29,1))] px-4 py-5">
            {messagesLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`message-skeleton-${index}`}
                    className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
                  >
                    <div className="max-w-[75%] animate-pulse rounded-3xl border border-[rgba(127,183,220,0.12)] bg-[rgba(16,33,49,0.82)] px-4 py-3">
                      <div className="mb-3 h-3 w-24 rounded bg-slate-800" />
                      <div className="h-3 w-56 rounded bg-slate-800" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !selectedRoom ? (
              <div className="flex h-full min-h-[300px] items-center justify-center">
                <div className="max-w-md text-center">
                  <p className="text-lg font-semibold text-white">No room selected</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Pick a room to view its messages, typing status, and live updates.
                  </p>
                </div>
              </div>
            ) : normalizedMessages.length === 0 ? (
              <div className="flex h-full min-h-[300px] items-center justify-center">
                <div className="max-w-md text-center">
                  <p className="text-lg font-semibold text-white">No messages yet</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Start the conversation in {getRoomTitle(selectedRoom)} with the message box below.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {normalizedMessages.map((message) => {
                  const showSenderName = !message.isSelf && selectedRoom?.roomType !== "private";

                  return (
                    <article
                      key={message.id}
                      className={`flex items-end gap-3 ${
                        message.isSelf ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!message.isSelf ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(127,183,220,0.18)] bg-[rgba(16,33,49,0.9)] text-xs font-semibold text-[#b4d8ee]">
                          {getInitials(message.normalizedSenderName)}
                        </div>
                      ) : null}

                      <div
                        className={`max-w-[85%] sm:max-w-[72%] ${
                          message.isSelf ? "items-end" : "items-start"
                        } flex flex-col`}
                      >
                        {showSenderName ? (
                          <p className="mb-1 px-2 text-xs font-medium tracking-wide text-slate-400">
                            {message.normalizedSenderName}
                          </p>
                        ) : null}

                        <div
                          className={`rounded-[1.6rem] px-4 py-3 shadow-lg ${
                            message.isSelf
                              ? "rounded-br-md bg-[#3880b0] text-[#08131d]"
                              : "rounded-bl-md border border-[rgba(127,183,220,0.14)] bg-[rgba(16,33,49,0.96)] text-slate-100"
                          }`}
                        >
                          <p className="text-sm leading-6">
                            {message.content?.trim() ? message.content : "[deleted]"}
                          </p>
                          <p
                            className={`mt-2 text-[11px] ${
                              message.isSelf ? "text-slate-800/80" : "text-slate-500"
                            }`}
                          >
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <form
            onSubmit={onSendMessage}
            className="border-t border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.86)] px-4 py-3 backdrop-blur"
          >
            <div className="mb-2 min-h-5">
              {typingLabel ? (
                <p className="text-xs text-slate-400">{typingLabel}</p>
              ) : error ? (
                <p className="text-xs text-rose-400">{error}</p>
              ) : (
                <p className="text-xs text-slate-500">
                  {selectedRoom
                    ? `Message ${getRoomTitle(selectedRoom)}`
                    : "Select a room to start messaging"}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <input
                value={messageInput}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder={selectedRoom ? "Type a message..." : "Choose a room first"}
                disabled={!selectedRoomId}
                className="flex-1 rounded-2xl border border-[rgba(127,183,220,0.18)] bg-[rgba(8,19,29,0.88)] px-4 py-3 text-sm text-slate-100 outline-none ring-[#3880b0] transition placeholder:text-slate-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || !selectedRoomId || !messageInput.trim()}
                className="rounded-2xl bg-[#3880b0] px-5 py-3 text-sm font-semibold text-[#08131d] transition hover:bg-[#4e93c1] disabled:cursor-not-allowed disabled:opacity-60"
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
