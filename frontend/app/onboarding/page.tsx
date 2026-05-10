"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding, Department, getCurrentUser, getDepartments } from "../../lib/api";
import { clearAccessToken, getAccessToken } from "../../lib/auth";

export default function OnboardingPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPlaceholder, setAvatarPlaceholder] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const normalizedUsername = useMemo(
    () => username.trim().toLowerCase().replace(/\s+/g, ""),
    [username]
  );

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/");
      return;
    }

    void loadData();
  }, [router]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [profile, departmentList] = await Promise.all([getCurrentUser(), getDepartments()]);
      setFullName(profile.fullName ?? "");
      setUsername(profile.username ?? "");
      setBio(profile.bio ?? "");
      setDepartmentId(profile.department?.id ?? departmentList[0]?.id ?? "");
      setDepartments(departmentList);

      if (profile.onboardingCompleted) {
        router.replace("/chat");
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("401") || message.includes("Unauthorized") || message.includes("NO_TOKEN")) {
        clearAccessToken();
        router.replace("/");
        return;
      }
      setError("Failed to load onboarding data.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const validationError = validate();
    if (validationError) {
      setSaving(false);
      setError(validationError);
      return;
    }

    try {
      await completeOnboarding({
        full_name: fullName.trim(),
        department_id: departmentId,
        username: normalizedUsername,
        bio: bio.trim() || undefined
      });
      router.replace("/chat");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Username is already in use")) {
        setError("This username is already taken.");
      } else if (message.includes("Department")) {
        setError("Selected department is invalid.");
      } else if (message.includes("401") || message.includes("Unauthorized") || message.includes("NO_TOKEN")) {
        clearAccessToken();
        router.replace("/");
      } else {
        setError("Onboarding could not be completed.");
      }
    } finally {
      setSaving(false);
    }
  }

  function validate(): string | null {
    if (!fullName.trim()) {
      return "Full name is required.";
    }

    if (!normalizedUsername) {
      return "Username is required.";
    }

    if (!/^[a-z0-9._]+$/.test(normalizedUsername)) {
      return "Use only lowercase letters, numbers, dots, and underscores.";
    }

    if (normalizedUsername.length < 3) {
      return "Username must be at least 3 characters.";
    }

    if (!departmentId) {
      return "Please select a department.";
    }

    return null;
  }

  function getInitials(): string {
    const source = fullName.trim() || normalizedUsername;
    const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
    if (parts.length === 0) {
      return "IS";
    }
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Loading onboarding...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Complete Your Profile</h1>
        <p className="mt-2 text-sm text-slate-400">
          Finish your student profile before entering the university chat network.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500 text-lg font-semibold text-slate-950">
              {getInitials()}
            </div>
            <div className="flex-1">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Avatar placeholder</span>
                <input
                  value={avatarPlaceholder}
                  onChange={(e) => setAvatarPlaceholder(e.target.value)}
                  placeholder="Optional visual placeholder label"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
                />
              </label>
              {/* TODO: persist avatar placeholder when backend profile media support is added */}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm lowercase outline-none ring-cyan-400 focus:ring-2"
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              Lowercase only. Letters, numbers, dots, and underscores are allowed.
            </p>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Department</span>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
              required
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Optional short bio"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
            />
          </label>

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Finish Onboarding"}
          </button>
        </form>
      </div>
    </main>
  );
}
