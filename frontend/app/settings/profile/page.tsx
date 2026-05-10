"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Department, getCurrentUser, getDepartments, updateCurrentUser } from "../../../lib/api";
import { clearAccessToken, getAccessToken } from "../../../lib/auth";
import { NotificationBell } from "../../../components/notification-bell";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

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
      const [profile, departmentList] = await Promise.all([getCurrentUser(), getDepartments()]);
      setDepartments(departmentList);
      setFullName(profile.fullName ?? "");
      setUsername(profile.username ?? "");
      setBio(profile.bio ?? "");
      setDepartmentId(profile.department?.id ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load profile settings.";
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

  function normalizeUsername(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9._]/g, "");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedFullName = fullName.trim();
    const normalizedUsername = normalizeUsername(username);

    if (!normalizedFullName) {
      setError("Full name is required.");
      return;
    }

    if (!normalizedUsername || normalizedUsername.length < 3) {
      setError("Username must be at least 3 characters and use only letters, numbers, dots, or underscores.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateCurrentUser({
        full_name: normalizedFullName,
        username: normalizedUsername,
        bio: bio.trim() || undefined,
        department_id: departmentId || undefined
      });
      setUsername(normalizedUsername);
      setSuccess("Profile updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile.";
      if (message.includes("Username is already in use")) {
        setError("That username is already taken.");
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
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
            <Link href="/settings" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Settings
            </Link>
            <Link href="/settings/profile" className="rounded-md bg-slate-800 px-2 py-1 text-cyan-300">
              Profile
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
            <h1 className="text-xl font-semibold">Profile Settings</h1>
            <p className="mt-2 text-sm text-slate-400">
              Update your student profile details and visible account information.
            </p>
          </div>

          {loading ? <p className="text-sm text-slate-400">Loading profile settings...</p> : null}

          {!loading ? (
            <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs text-slate-400">Full name</span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Username</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(normalizeUsername(event.target.value))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Department</span>
                <select
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs text-slate-400">Bio</span>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs text-slate-400">Avatar placeholder URL</span>
                <input
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
                />
                {/* TODO: persist avatar placeholder when backend profile media support is added */}
              </label>

              {error ? <p className="text-sm text-rose-400 md:col-span-2">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-400 md:col-span-2">{success}</p> : null}

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-70"
                >
                  {saving ? "Saving..." : "Save profile"}
                </button>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
