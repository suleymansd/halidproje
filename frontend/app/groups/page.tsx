"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GroupSummary, createGroup, getGroups } from "../../lib/api";
import { clearAccessToken, getAccessToken } from "../../lib/auth";
import { NotificationBell } from "../../components/notification-bell";

export default function GroupsPage() {
  const PAGE_SIZE = 12;
  const router = useRouter();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }
    void loadGroups();
  }, [router]);

  async function loadGroups() {
    setLoading(true);
    setError(null);
    try {
      setGroups(await getGroups());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load groups.";
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

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility
      });
      setGroups((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setVisibleCount(PAGE_SIZE);
      setName("");
      setDescription("");
      setVisibility("public");
      setSuccess("Group created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group.");
    } finally {
      setSubmitting(false);
    }
  }

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) =>
      [group.name, group.description, group.owner?.fullName, group.owner?.username]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [groups, search]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search]);

  const visibleGroups = useMemo(
    () => filteredGroups.slice(0, visibleCount),
    [filteredGroups, visibleCount]
  );

  function logout() {
    clearAccessToken();
    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100">
      <div className="mx-auto max-w-6xl">
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
            <Link href="/groups" className="rounded-md bg-slate-800 px-2 py-1 text-cyan-300">
              Groups
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

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <form onSubmit={onCreate} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 text-lg font-semibold">Create Group</h2>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-slate-400">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-slate-400">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
              />
            </label>
            <label className="mb-4 block">
              <span className="mb-1 block text-xs text-slate-400">Visibility</span>
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as "public" | "private")}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-70"
            >
              {submitting ? "Creating..." : "Create Group"}
            </button>
            {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
            {success ? <p className="mt-3 text-sm text-emerald-400">{success}</p> : null}
          </form>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Groups</h2>
                <p className="text-sm text-slate-400">Browse school groups and open their related room.</p>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search groups..."
                className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
              />
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Loading groups...</p>
            ) : filteredGroups.length === 0 ? (
              <p className="text-sm text-slate-400">No groups found.</p>
            ) : (
              <div className="space-y-3">
                {visibleGroups.map((group) => (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="block rounded-lg border border-slate-800 bg-slate-950 p-4 hover:border-slate-700"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{group.name}</h3>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] uppercase text-slate-400">
                        {group.visibility ?? "public"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{group.description || "No description."}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>Members: {group.memberCount ?? 0}</span>
                      <span>Owner: {group.owner?.fullName || group.owner?.username || "Unknown"}</span>
                    </div>
                  </Link>
                ))}
                {filteredGroups.length > visibleGroups.length ? (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                      className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
                    >
                      More groups
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
