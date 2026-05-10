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
  const PAGE_SIZE = 15;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
      setVisibleCount(PAGE_SIZE);
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

  const visibleResults = useMemo(
    () => results.slice(0, visibleCount),
    [results, visibleCount]
  );

  function toMaterialHref(result: SearchResult): string | null {
    if (result.entityType !== "material") return null;
    return `/materials/${result.entityId}`;
  }

  function toUserHref(result: SearchResult): string | null {
    if (result.entityType !== "user") return null;
    return `/users/${result.entityId}`;
  }

  function toGroupHref(result: SearchResult): string | null {
    if (result.entityType !== "group") return null;
    return `/groups/${result.entityId}`;
  }

  return (
    <main className="search-scene relative min-h-screen overflow-x-hidden text-slate-100">
      <div className="search-pattern pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-4 py-4">
        <header className="mb-4 flex items-center justify-between rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.9)] px-4 py-3 shadow-[0_20px_80px_rgba(8,19,29,0.35)] backdrop-blur">
          <div className="flex items-center gap-3 text-sm">
            <Link href="/chat" className="rounded-full px-3 py-1.5 hover:bg-[rgba(56,128,176,0.12)]">
              Chat
            </Link>
            <Link href="/materials" className="rounded-full px-3 py-1.5 hover:bg-[rgba(56,128,176,0.12)]">
              Materials
            </Link>
            <Link href="/search" className="rounded-full bg-[#3880b0] px-3 py-1.5 font-medium text-[#08131d]">
              Search
            </Link>
            <Link href="/groups" className="rounded-full px-3 py-1.5 hover:bg-[rgba(56,128,176,0.12)]">
              Groups
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={logout}
              className="rounded-full border border-[rgba(127,183,220,0.2)] px-3 py-1.5 text-sm hover:bg-[rgba(56,128,176,0.12)]"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(16,33,49,0.88)] p-4 shadow-[0_20px_80px_rgba(8,19,29,0.28)] backdrop-blur">
          <form onSubmit={onSearch} className="mb-4 flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search materials, users, groups..."
                className="flex-1 rounded-2xl border border-[rgba(127,183,220,0.16)] bg-[rgba(8,19,29,0.82)] px-4 py-3 text-sm outline-none ring-[#3880b0] focus:ring-2"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-[#3880b0] px-5 py-3 text-sm font-medium text-[#08131d] hover:bg-[#4e93c1] disabled:opacity-70"
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
                  className={`rounded-full px-3 py-1.5 text-xs ${
                    activeTab === tab.key
                      ? "bg-[#3880b0] font-semibold text-[#08131d]"
                      : "border border-[rgba(127,183,220,0.18)] text-slate-300 hover:bg-[rgba(56,128,176,0.12)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </form>

          {error ? (
            <p className="mb-3 rounded-2xl border border-rose-800 bg-rose-950/30 px-3 py-3 text-sm text-rose-300">
              {error}
            </p>
          ) : null}

          {!loading && submitted && results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[rgba(127,183,220,0.18)] bg-[rgba(8,19,29,0.42)] px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-200">No results found.</p>
              <p className="mt-2 text-sm text-slate-400">Try another keyword or switch the active tab.</p>
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`search-skeleton-${index}`}
                  className="animate-pulse rounded-2xl border border-[rgba(127,183,220,0.12)] bg-[rgba(8,19,29,0.72)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="h-5 w-16 rounded-full bg-[rgba(56,128,176,0.16)]" />
                    <div className="h-3 w-28 rounded bg-slate-800" />
                  </div>
                  <div className="h-4 w-1/2 rounded bg-slate-800" />
                  <div className="mt-3 h-3 w-full rounded bg-slate-800" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleResults.map((result) => {
                const materialHref = toMaterialHref(result);
                const userHref = toUserHref(result);
                const groupHref = toGroupHref(result);
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

                if (materialHref || userHref || groupHref) {
                  return (
                    <Link
                      key={`${result.entityType}-${result.entityId}`}
                      href={materialHref ?? userHref ?? groupHref ?? "#"}
                      className="block rounded-2xl border border-[rgba(127,183,220,0.14)] bg-[rgba(8,19,29,0.76)] p-4 hover:border-[rgba(127,183,220,0.3)]"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    key={`${result.entityType}-${result.entityId}`}
                    className="rounded-2xl border border-[rgba(127,183,220,0.14)] bg-[rgba(8,19,29,0.76)] p-4"
                  >
                    {content}
                  </div>
                );
              })}
              {results.length > visibleResults.length ? (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                    className="rounded-full border border-[rgba(127,183,220,0.18)] px-4 py-2 text-sm text-slate-300 hover:bg-[rgba(56,128,176,0.12)]"
                  >
                    More results
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
