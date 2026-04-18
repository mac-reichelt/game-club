"use client";

import { useState, useMemo } from "react";
import { GameWithNominator, StoreLink } from "@/lib/types";
import Link from "next/link";

export interface NominationStats {
  gameId: number;
  timesNominated: number;
  firstNominatedAt: string;
  lastNominatedAt: string;
}

interface PastElection {
  id: number;
  name: string;
  closed_at: string | null;
}

type SortKey = "name" | "first" | "last" | "count";

function getStoreIcon(storeName: string): string {
  const icons: Record<string, string> = {
    Steam: "🎮",
    "PlayStation Store": "🎮",
    "Xbox Store": "🎮",
    "Nintendo Store": "🎮",
    "Epic Games": "🎮",
    GOG: "🎮",
    "App Store": "📱",
    "Google Play": "📱",
    "itch.io": "🕹️",
  };
  return icons[storeName] || "🔗";
}

function monthLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function NominationsList({
  nominations,
  stats,
  electionHistory,
}: {
  nominations: GameWithNominator[];
  stats: Record<number, NominationStats>;
  electionHistory: Record<number, PastElection[]>;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("last");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = nominations.filter((g) => {
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        (g.platform?.toLowerCase().includes(q) ?? false) ||
        g.nominatorName.toLowerCase().includes(q)
      );
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const sa = stats[a.id];
      const sb = stats[b.id];
      switch (sortKey) {
        case "name":
          return a.title.localeCompare(b.title) * dir;
        case "count":
          return ((sa?.timesNominated ?? 1) - (sb?.timesNominated ?? 1)) * dir;
        case "first":
          return (
            ((sa?.firstNominatedAt ?? a.nominated_at) <
            (sb?.firstNominatedAt ?? b.nominated_at)
              ? -1
              : 1) * dir
          );
        case "last":
          return (
            ((sa?.lastNominatedAt ?? a.nominated_at) <
            (sb?.lastNominatedAt ?? b.nominated_at)
              ? -1
              : 1) * dir
          );
      }
    });
  }, [nominations, stats, search, sortKey, sortDir]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, platform, or nominator..."
          className="flex-1 px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
        >
          <option value="last">Sort: Last nominated</option>
          <option value="first">Sort: First nominated</option>
          <option value="count">Sort: Times nominated</option>
          <option value="name">Sort: Name</option>
        </select>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm hover:bg-[var(--color-surface-hover)]"
          title={sortDir === "asc" ? "Ascending" : "Descending"}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>
      </div>

      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        Showing {filteredSorted.length} of {nominations.length}
      </p>

      <div className="grid gap-3">
        {filteredSorted.length === 0 ? (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 text-center text-[var(--color-text-muted)]">
            <p className="text-lg mb-1">No nominations match.</p>
          </div>
        ) : (
          filteredSorted.map((game) => {
            let stores: StoreLink[] = [];
            try {
              if (game.stores_json) stores = JSON.parse(game.stores_json);
            } catch { /* ignore */ }
            const trailerUrl = game.trailer_url || "";
            const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
              game.title + " official trailer"
            )}`;
            const pastElections = electionHistory[game.id] || [];
            const s = stats[game.id];

            return (
              <div
                key={game.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-primary)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/games/${game.id}`}
                    className="text-lg font-semibold hover:text-[var(--color-primary)]"
                  >
                    {game.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {game.platform && (
                      <span className="inline-block px-2 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs rounded">
                        {game.platform}
                      </span>
                    )}
                    <span className="text-sm text-[var(--color-text-muted)]">
                      Nominated by {game.nominatorName}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-[var(--color-text-muted)]">
                    <span>
                      Nominated{" "}
                      <strong className="text-[var(--color-text)]">
                        {s?.timesNominated ?? 1}×
                      </strong>
                    </span>
                    <span>
                      First:{" "}
                      <strong className="text-[var(--color-text)]">
                        {monthLabel(s?.firstNominatedAt ?? game.nominated_at)}
                      </strong>
                    </span>
                    <span>
                      Last:{" "}
                      <strong className="text-[var(--color-text)]">
                        {monthLabel(s?.lastNominatedAt ?? game.nominated_at)}
                      </strong>
                    </span>
                  </div>

                  {game.description && (
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                      {game.description}
                    </p>
                  )}

                  {pastElections.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Past elections:
                      </span>
                      {pastElections.map((el) => (
                        <Link
                          key={el.id}
                          href={`/elections/${el.id}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                        >
                          🗳️ {el.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
                    {stores.map((store) => (
                      <a
                        key={store.url}
                        href={store.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
                        title={`View on ${store.name}`}
                      >
                        <span>{getStoreIcon(store.name)}</span>
                        {store.name}
                      </a>
                    ))}
                    {trailerUrl ? (
                      <a
                        href={trailerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Watch trailer"
                      >
                        <span>▶</span> Trailer
                      </a>
                    ) : (
                      <a
                        href={youtubeSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Search for trailer on YouTube"
                      >
                        <span>▶</span> Find Trailer
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
