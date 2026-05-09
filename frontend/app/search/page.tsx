"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SearchResult,
  searchAll,
  searchGroups,
  searchMaterials,
  searchUsers
} from "../../lib/api";
import { clearAccessToken, getAccessToken } from "../../lib/auth";
import { NotificationBell } from "../../components/notification-bell";

type SearchTab = "all" | "materials" | "users" | "groups";
type SearchEntityType = "material" | "user" | "group";

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const tabs: Array<{ key: SearchTab; label: string }> = useMemo(
    () => [
      { key: "all", label: "All" },
      { key: "materials", label: "Materials" },
      { key: "users", label: "Users" },
      { key: "groups", label: "Groups" }
    ],
    []
  );

  function getValidToken() {
    const token = getAccessToken();
    if (!token) {
      return null;
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return token;
    }

    try {
      const payload = JSON.parse(atob(parts[1])) as { exp?: number };
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        clearAccessToken();
        return null;
      }
    } catch {
      return token;
    }

    return token;
  }

  function ensureToken() {
    const token = getValidToken();
    if (!token) {
      router.replace("/");
      return false;
    }
    return true;
  }

  function logout() {
    clearAccessToken();
    router.replace("/");
  }

  function isAuthError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : "";
    return (
      message.includes("NO_TOKEN") ||
      message.includes("401") ||
      message.includes("Unauthorized")
    );
  }

  function normalizeEntityType(value?: string): SearchEntityType {
    const normalized = (value ?? "").toLowerCase();
    if (normalized === "material" || normalized === "materials") return "material";
    if (normalized === "user" || normalized === "users") return "user";
    return "group";
  }

  function mapToSearchResult(
    raw: Record<string, unknown>,
    fallbackType: SearchEntityType
  ): SearchResult {
    const entityType = normalizeEntityType(
      typeof raw.entityType === "string" ? raw.entityType : fallbackType
    );
    const entityId =
      (typeof raw.entityId === "string" && raw.entityId) ||
      (typeof raw.id === "string" && raw.id) ||
      "";
    const title =
      (typeof raw.title === "string" && raw.title) ||
      (typeof raw.name === "string" && raw.name) ||
      (typeof raw.fullName === "string" && raw.fullName) ||
      (typeof raw.username === "string" && raw.username) ||
      "Untitled";
    const preview =
      (typeof raw.preview === "string" && raw.preview) ||
      (typeof raw.description === "string" && raw.description) ||
      (typeof raw.bio === "string" && raw.bio) ||
      undefined;
    const createdAt =
      (typeof raw.createdAt === "string" && raw.createdAt) ||
      (typeof raw.created_at === "string" && raw.created_at) ||
      undefined;

    return {
      entityType,
      entityId,
      title,
      preview,
      createdAt,
      metadata:
        raw.metadata && typeof raw.metadata === "object"
          ? (raw.metadata as Record<string, unknown>)
          : undefined,
      relevanceScore:
        typeof raw.relevanceScore === "number"
          ? raw.relevanceScore
          : typeof raw.relevance_score === "number"
            ? raw.relevance_score
            : undefined
    };
  }

  function pickArray(
    value: unknown
  ): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    );
  }

  function normalizeSearchResponse(
    payload: unknown,
    tab: SearchTab
  ): SearchResult[] {
    if (Array.isArray(payload)) {
      return payload
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => mapToSearchResult(item, tab === "all" ? "material" : normalizeEntityType(tab)));
    }

    if (!payload || typeof payload !== "object") {
      return [];
    }

    const data = payload as Record<string, unknown>;
    const directResults = pickArray(data.results);
    if (directResults.length > 0) {
      return directResults.map((item) => mapToSearchResult(item, tab === "all" ? "material" : normalizeEntityType(tab)));
    }

    const items = pickArray(data.items);
    if (items.length > 0) {
      return items.map((item) => mapToSearchResult(item, tab === "all" ? "material" : normalizeEntityType(tab)));
    }

    const materials = pickArray(data.materials).map((item) =>
      mapToSearchResult(item, "material")
    );
    const users = pickArray(data.users).map((item) => mapToSearchResult(item, "user"));
    const groups = pickArray(data.groups).map((item) => mapToSearchResult(item, "group"));

    if (tab === "materials") return materials;
    if (tab === "users") return users;
    if (tab === "groups") return groups;

    return [...materials, ...users, ...groups];
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ensureToken()) return;

    const trimmed = query.trim();
    setSubmitted(true);
    if (!trimmed) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response =
        activeTab === "materials"
          ? await searchMaterials(trimmed)
          : activeTab === "users"
            ? await searchUsers(trimmed)
            : activeTab === "groups"
              ? await searchGroups(trimmed)
              : await searchAll(trimmed);

      setResults(normalizeSearchResponse(response, activeTab));
    } catch (err) {
      if (isAuthError(err)) {
        clearAccessToken();
        router.replace("/");
        return;
      }

      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  function toMaterialHref(result: SearchResult): string | null {
    if (result.entityType !== "material") return null;
    return `/materials/${result.entityId}`;
  }

  function toUserHref(result: SearchResult): string | null {
    if (result.entityType !== "user") return null;
    return `/users/${result.entityId}`;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <header className="mb-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/chat" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Chat
            </Link>
            <Link href="/materials" className="rounded-md px-2 py-1 hover:bg-slate-800">
              Materials
            </Link>
            <Link href="/search" className="rounded-md bg-slate-800 px-2 py-1 text-cyan-300">
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

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <form onSubmit={onSearch} className="mb-4 flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search materials, users, groups..."
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 focus:ring-2"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:opacity-70"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-md px-3 py-1 text-xs ${
                    activeTab === tab.key
                      ? "bg-cyan-500 font-semibold text-slate-950"
                      : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </form>

          {error ? (
            <p className="mb-3 rounded-md border border-rose-800 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          ) : null}

          {!loading && submitted && results.length === 0 ? (
            <p className="text-sm text-slate-400">No results found.</p>
          ) : null}

          {loading ? (
            <p className="text-sm text-slate-400">Loading results...</p>
          ) : (
            <div className="space-y-3">
              {results.map((result) => {
                const materialHref = toMaterialHref(result);
                const userHref = toUserHref(result);
                const content = (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] uppercase text-cyan-300">
                        {result.entityType}
                      </span>
                      {result.createdAt ? (
                        <span className="text-xs text-slate-400">
                          {new Date(result.createdAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-sm font-semibold">{result.title}</h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {result.preview || "No preview available"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">ID: {result.entityId}</p>
                  </>
                );

                if (materialHref || userHref) {
                  return (
                    <Link
                      key={`${result.entityType}-${result.entityId}`}
                      href={materialHref ?? userHref ?? "#"}
                      className="block rounded-lg border border-slate-800 bg-slate-950 p-3 hover:border-slate-700"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    key={`${result.entityType}-${result.entityId}`}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
