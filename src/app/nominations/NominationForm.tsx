"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: number;
  name: string;
  image: string | null;
  released: string | null;
  metacritic: number | null;
  platforms: string;
  genres: string;
}

export default function NominationForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Selected game / manual mode
  const [selectedGame, setSelectedGame] = useState<SearchResult | null>(null);
  const [manualMode, setManualMode] = useState(false);

  // Manual fields
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [description, setDescription] = useState("");
  const [linksText, setLinksText] = useState("");

  // Store/trailer data from RAWG
  const [storesJson, setStoresJson] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [loadingDetails, setLoadingDetails] = useState(false);

  function inferStoreName(domain: string): string {
    if (domain.includes("steampowered") || domain.includes("store.steam")) return "Steam";
    if (domain.includes("playstation")) return "PlayStation Store";
    if (domain.includes("microsoft") || domain.includes("xbox")) return "Xbox Store";
    if (domain.includes("nintendo")) return "Nintendo Store";
    if (domain.includes("epicgames")) return "Epic Games";
    if (domain.includes("gog.com")) return "GOG";
    if (domain.includes("itch.io")) return "itch.io";
    if (domain.includes("apple.com")) return "App Store";
    if (domain.includes("play.google")) return "Google Play";
    return domain;
  }

  function parseLinks(text: string): { stores: string; trailer: string } {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const stores: { name: string; url: string; domain: string }[] = [];
    let trailer = "";

    for (const line of lines) {
      try {
        const url = new URL(line);
        const host = url.hostname.replace("www.", "");
        if (host.includes("youtube.com") || host.includes("youtu.be")) {
          if (!trailer) trailer = line;
        } else {
          stores.push({ name: inferStoreName(host), url: line, domain: host });
        }
      } catch {
        // skip non-URL lines
      }
    }

    return {
      stores: stores.length > 0 ? JSON.stringify(stores) : "",
      trailer,
    };
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchGames = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch(`/api/games/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const data = await res.json();
        setSearchError(data.error || "Search failed");
        setResults([]);
      } else {
        const data = await res.json();
        setResults(data);
        setShowResults(true);
      }
    } catch {
      setSearchError("Search failed");
      setResults([]);
    }
    setSearching(false);
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedGame(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchGames(value), 350);
  }

  async function selectGame(game: SearchResult) {
    setSelectedGame(game);
    setQuery(game.name);
    setShowResults(false);

    // Pre-fill fields from RAWG data
    setTitle(game.name);
    setPlatform(game.platforms);
    setDescription(
      [game.genres, game.released ? `Released ${game.released}` : ""]
        .filter(Boolean)
        .join(" · ")
    );

    // Fetch store links and trailers
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/games/search/${game.id}`);
      if (res.ok) {
        const details = await res.json();
        if (details.stores && details.stores.length > 0) {
          setStoresJson(JSON.stringify(details.stores));
        }
        if (details.trailerUrl) {
          setTrailerUrl(details.trailerUrl);
        }
      }
    } catch {
      // Silently fail — stores/trailer are optional
    }
    setLoadingDetails(false);
  }

  function switchToManual() {
    setManualMode(true);
    setSelectedGame(null);
    setResults([]);
    setShowResults(false);
    // Keep whatever was typed in search as the title
    setTitle(query);
  }

  function switchToSearch() {
    setManualMode(false);
    setSelectedGame(null);
    setQuery(title);
  }

  function handleReset() {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setSelectedGame(null);
    setManualMode(false);
    setTitle("");
    setPlatform("");
    setDescription("");
    setLinksText("");
    setSearchError("");
    setStoresJson("");
    setTrailerUrl("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    let finalStores = storesJson;
    let finalTrailer = trailerUrl;

    // For manual mode, parse the links textarea
    if (manualMode && linksText.trim()) {
      const parsed = parseLinks(linksText);
      finalStores = parsed.stores;
      if (parsed.trailer) finalTrailer = parsed.trailer;
    }

    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        platform: platform.trim() || undefined,
        description: description.trim() || undefined,
        storesJson: finalStores || undefined,
        trailerUrl: finalTrailer || undefined,
      }),
    });

    if (res.ok) {
      handleReset();
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to nominate");
    }
    setSubmitting(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-xl p-4 text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
      >
        + Nominate a Game
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--color-surface)] border border-[var(--color-primary)] rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Nominate a Game</h3>
        <button
          type="button"
          onClick={manualMode ? switchToSearch : switchToManual}
          className="text-xs text-[var(--color-primary)] hover:underline"
        >
          {manualMode ? "← Search for a game" : "Enter manually"}
        </button>
      </div>

      {!manualMode ? (
        <>
          {/* Search mode */}
          <div ref={searchRef} className="relative mb-4">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => results.length > 0 && setShowResults(true)}
                placeholder="Search for a game..."
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">
                  Searching...
                </span>
              )}
            </div>

            {searchError && (
              <p className="text-xs text-[var(--color-danger)] mt-1">
                {searchError}
              </p>
            )}

            {/* Search results dropdown */}
            {showResults && results.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {results.map((game) => (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => selectGame(game)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--color-surface-hover)] transition-colors text-left border-b border-[var(--color-border)] last:border-0"
                  >
                    {game.image ? (
                      <img
                        src={game.image}
                        alt={game.name}
                        className="w-12 h-12 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-[var(--color-bg)] flex items-center justify-center text-lg shrink-0">
                        🎮
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {game.name}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] truncate">
                        {[
                          game.platforms,
                          game.released?.slice(0, 4),
                          game.metacritic
                            ? `Metacritic: ${game.metacritic}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={switchToManual}
                  className="w-full px-3 py-2.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] transition-colors text-left"
                >
                  Don&apos;t see your game? Enter manually →
                </button>
              </div>
            )}

            {/* No results message */}
            {showResults &&
              query.length >= 2 &&
              !searching &&
              results.length === 0 &&
              !searchError && (
                <div className="absolute z-10 top-full mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg p-3">
                  <p className="text-sm text-[var(--color-text-muted)] mb-2">
                    No results found for &quot;{query}&quot;
                  </p>
                  <button
                    type="button"
                    onClick={switchToManual}
                    className="text-xs text-[var(--color-primary)] hover:underline"
                  >
                    Enter manually →
                  </button>
                </div>
              )}
          </div>

          {/* Selected game preview */}
          {selectedGame && (
            <div className="flex items-start gap-4 bg-[var(--color-bg)] rounded-lg p-4 mb-4">
              {selectedGame.image ? (
                <img
                  src={selectedGame.image}
                  alt={selectedGame.name}
                  className="w-20 h-20 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center text-3xl shrink-0">
                  🎮
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium">{selectedGame.name}</h4>
                {selectedGame.platforms && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {selectedGame.platforms}
                  </p>
                )}
                {selectedGame.genres && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {selectedGame.genres}
                  </p>
                )}
                {selectedGame.released && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Released {selectedGame.released}
                  </p>
                )}
                {selectedGame.metacritic && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                    Metacritic: {selectedGame.metacritic}
                  </span>
                )}
                {loadingDetails && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Loading store links...
                  </p>
                )}
                {!loadingDetails && storesJson && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(JSON.parse(storesJson) as { name: string; url: string }[]).map((store) => (
                      <a
                        key={store.url}
                        href={store.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                      >
                        🔗 {store.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Trailer link input when game selected */}
          {selectedGame && (
            <div className="mb-4">
              <label className="block text-sm text-[var(--color-text-muted)] mb-1">
                Trailer Link
              </label>
              <input
                type="url"
                value={trailerUrl}
                onChange={(e) => setTrailerUrl(e.target.value)}
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
                placeholder="YouTube or video URL (leave blank to auto-search)"
              />
            </div>
          )}
        </>
      ) : (
        <>
          {/* Manual entry mode */}
          <div className="mb-4">
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">
              Game Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
              placeholder="e.g. Hades"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">
              Links
            </label>
            <textarea
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
              rows={3}
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none"
              placeholder={"Paste store or trailer links, one per line\ne.g. https://store.steampowered.com/app/1145360/\nhttps://www.youtube.com/watch?v=..."}
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              YouTube links become the trailer. Others show as store links.
            </p>
          </div>
        </>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {submitting ? "Nominating..." : "Nominate"}
        </button>
      </div>
    </form>
  );
}
