"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Department, getDepartments } from "../../lib/api";
import { clearAccessToken, getAccessToken } from "../../lib/auth";
import { NotificationBell } from "../../components/notification-bell";

export default function DepartmentsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/");
      return;
    }

    void loadDepartments();
  }, [router]);

  async function loadDepartments() {
    setLoading(true);
    setError(null);
    try {
      setDepartments(await getDepartments());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load departments.";
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

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return departments;
    return departments.filter((department) =>
      [department.name, department.code, department.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [departments, query]);

  function logout() {
    clearAccessToken();
    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/chat" className="rounded-md px-2 py-1 hover:bg-slate-800">Chat</Link>
            <Link href="/materials" className="rounded-md px-2 py-1 hover:bg-slate-800">Materials</Link>
            <Link href="/search" className="rounded-md px-2 py-1 hover:bg-slate-800">Search</Link>
            <Link href="/departments" className="rounded-md bg-slate-800 px-2 py-1 text-cyan-300">Departments</Link>
            <Link href="/courses" className="rounded-md px-2 py-1 hover:bg-slate-800">Courses</Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={logout} className="rounded-md border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800">
              Logout
            </button>
          </div>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Departments</h1>
              <p className="mt-1 text-sm text-slate-400">Browse the academic structure across your school.</p>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search departments..."
              className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
            />
          </div>

          {loading ? <p className="text-sm text-slate-400">Loading departments...</p> : null}
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          {!loading && !error ? (
            filtered.length === 0 ? (
              <p className="text-sm text-slate-400">No departments match your search.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((department) => (
                  <Link
                    key={department.id}
                    href={`/departments/${department.id}`}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4 hover:border-slate-700"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{department.code || "Department"}</p>
                    <h2 className="mt-2 font-semibold">{department.name}</h2>
                    <p className="mt-2 text-sm text-slate-400">{department.description || "No description available."}</p>
                  </Link>
                ))}
              </div>
            )
          ) : null}
        </section>
      </div>
    </main>
  );
}
