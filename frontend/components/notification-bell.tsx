"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem
} from "../lib/api";
import { clearAccessToken, getAccessToken } from "../lib/auth";

type NotificationCreatedPayload = {
  id: string;
  title: string;
  content: string;
  type: "message" | "material" | "system";
  relatedId?: string;
  createdAt: string;
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      return;
    }

    void loadInitial();

    const socket: Socket = io("http://localhost:3002/chat", {
      auth: {
        token: `Bearer ${token}`
      }
    });

    socket.on("notification.created", (payload: NotificationCreatedPayload) => {
      const mapped: NotificationItem = {
        id: payload.id,
        title: payload.title,
        content: payload.content,
        type: payload.type,
        isRead: false,
        createdAt: payload.createdAt,
        relatedId: payload.relatedId ?? null
      };
      setItems((prev) => [mapped, ...prev.filter((item) => item.id !== mapped.id)].slice(0, 20));
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void markAllReadIfNeeded();
  }, [open]);

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [items]
  );

  async function loadInitial() {
    try {
      const [notifications, unread] = await Promise.all([
        getNotifications(),
        getUnreadNotificationCount()
      ]);
      setItems(notifications.items ?? []);
      setUnreadCount(unread.count ?? 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (
        message.includes("NO_TOKEN") ||
        message.includes("401") ||
        message.includes("Unauthorized")
      ) {
        clearAccessToken();
      }
    }
  }

  async function markAllReadIfNeeded() {
    if (unreadCount <= 0) {
      return;
    }

    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch {
      // no-op
    }
  }

  function formatRelative(value: string) {
    const diffMs = Date.now() - new Date(value).getTime();
    if (diffMs < 60_000) return "just now";
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour} hour ago`;
  }

  async function onNotificationClick(item: NotificationItem) {
    try {
      await markNotificationRead(item.id);
    } catch {
      // no-op
    }

    setItems((prev) =>
      prev.map((notification) =>
        notification.id === item.id ? { ...notification, isRead: true } : notification
      )
    );
    setUnreadCount((prev) => Math.max(prev - (item.isRead ? 0 : 1), 0));
    setOpen(false);

    if (item.type === "message" && item.relatedId) {
      router.push(`/chat?roomId=${item.relatedId}`);
      return;
    }

    if ((item.type === "material" || item.referenceType === "material") && item.relatedId) {
      router.push(`/materials/${item.relatedId}`);
      return;
    }

    router.push("/chat");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-md border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800"
      >
        Bell
        {unreadCount > 0 ? (
          <span className="absolute -right-2 -top-2 min-w-[18px] rounded-full bg-cyan-500 px-1 text-[11px] font-semibold text-slate-950">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-slate-800 bg-slate-900 p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-2 py-1">
            <p className="text-sm font-medium">Notifications</p>
            <span className="text-xs text-slate-400">{unreadCount} unread</span>
          </div>

          <div className="max-h-80 space-y-1 overflow-y-auto">
            {sortedItems.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-400">No notifications yet.</p>
            ) : (
              sortedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void onNotificationClick(item)}
                  className={`w-full rounded-md px-2 py-2 text-left hover:bg-slate-800 ${
                    item.isRead ? "opacity-80" : "bg-slate-800/60"
                  }`}
                >
                  <p className="text-xs font-medium text-slate-100">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-300">{item.content}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{formatRelative(item.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
