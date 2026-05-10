"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  NotificationPreferences,
  getNotificationPreferences,
  updateNotificationPreferences
} from "../../lib/api";
import { clearAccessToken, getAccessToken } from "../../lib/auth";
import { NotificationBell } from "../../components/notification-bell";

export default function SettingsPage() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }

    void loadPreferences();
  }, [router]);

  async function loadPreferences() {
    setLoading(true);
    setError(null);
    try {
      setPreferences(await getNotificationPreferences());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load settings.";
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

  async function onToggle(key: keyof NotificationPreferences, value: boolean) {
    if (!preferences) return;

    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateNotificationPreferences({
        messageNotificationsEnabled: next.messageNotificationsEnabled,
        socialNotificationsEnabled: next.socialNotificationsEnabled,
        materialNotificationsEnabled: next.materialNotificationsEnabled,
        systemNotificationsEnabled: next.systemNotificationsEnabled
      });
      setPreferences(updated);
      setSuccess("Notification preferences saved.");
    } catch (err) {
      setPreferences(preferences);
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearAccessToken();
    router.replace("/");
  }

  const cards = [
    {
      key: "messageNotificationsEnabled" as const,
      title: "DM notifications",
      description: "Receive alerts for direct messages."
    },
    {
      key: "socialNotificationsEnabled" as const,
      title: "Group notifications",
      description: "Receive alerts for social and group activity."
    },
    {
      key: "materialNotificationsEnabled" as const,
      title: "Material notifications",
      description: "Receive alerts for material comments and updates."
    }
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/chat" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Chat
            </Link>
            <Link href="/settings" className="rounded-md bg-slate-800 px-2 py-1 text-cyan-300">
              Settings
            </Link>
            <Link href="/settings/profile" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Profile
            </Link>
            <Link href="/friends" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Friends
            </Link>
            <Link href="/departments" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Departments
            </Link>
            <Link href="/courses" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Courses
            </Link>
            <Link href="/admin" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Admin
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
          <div className="mb-5">
            <h1 className="text-xl font-semibold">Notification Settings</h1>
            <p className="mt-2 text-sm text-slate-400">
              Control which university updates should surface in your notifications.
            </p>
          </div>

          {loading ? <p className="text-sm text-slate-400">Loading settings...</p> : null}
          {error ? <p className="mb-3 text-sm text-rose-400">{error}</p> : null}
          {success ? <p className="mb-3 text-sm text-emerald-400">{success}</p> : null}

          {!loading && preferences ? (
            <div className="space-y-3">
              {cards.map((card) => (
                <div
                  key={card.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4"
                >
                  <div>
                    <h2 className="font-medium">{card.title}</h2>
                    <p className="mt-1 text-sm text-slate-400">{card.description}</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(preferences[card.key])}
                      onChange={(event) => onToggle(card.key, event.target.checked)}
                      disabled={saving}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-300">
                      {preferences[card.key] ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                </div>
              ))}

              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                System notifications remain enabled for account and safety events.
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
