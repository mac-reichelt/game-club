import getDb from "@/lib/db";
import { GameWithNominator, ReviewWithMember } from "@/lib/types";
import { requireAuth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReviewForm from "./ReviewForm";
import { getGamedbDetail, isGamedbConfigured, GamedbDetail } from "@/lib/gamedb";

export const dynamic = "force-dynamic";

interface PastElectionRow {
  id: number;
  name: string;
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  winner_id: number | null;
  ballot_count: number;
}

function getGame(
  db: ReturnType<typeof getDb>,
  id: number
): GameWithNominator | null {
  return db
    .prepare(
      `SELECT g.*, m.name as nominatorName
       FROM games g
       JOIN members m ON g.nominated_by = m.id
       WHERE g.id = ?`
    )
    .get(id) as GameWithNominator | null;
}

function getReviews(
  db: ReturnType<typeof getDb>,
  gameId: number
): ReviewWithMember[] {
  return db
    .prepare(
      `SELECT r.*, m.name as memberName, m.avatar as memberAvatar
       FROM reviews r
       JOIN members m ON r.member_id = m.id
       WHERE r.game_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(gameId) as ReviewWithMember[];
}

function getElectionsForGame(
  db: ReturnType<typeof getDb>,
  gameId: number
): PastElectionRow[] {
  return db
    .prepare(
      `SELECT e.id, e.name, e.status, e.created_at, e.closed_at, e.winner_id,
              (SELECT COUNT(DISTINCT b.member_id) FROM ballots b WHERE b.election_id = e.id) as ballot_count
       FROM election_games eg
       JOIN elections e ON e.id = eg.election_id
       WHERE eg.game_id = ?
       ORDER BY e.created_at DESC`
    )
    .all(gameId) as PastElectionRow[];
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={
            i <= rating
              ? "text-[var(--color-star)]"
              : "text-[var(--color-border)]"
          }
        >
          ★
        </span>
      ))}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function fmtMonth(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

async function fetchGamedb(game: GameWithNominator): Promise<GamedbDetail | null> {
  if (!isGamedbConfigured()) return null;
  try {
    if (game.gamedb_id) {
      return await getGamedbDetail(game.gamedb_id);
    }
    // Legacy nominations have no gamedb_id; cannot enrich without a RAWG id.
    return null;
  } catch (err) {
    console.error("gamedb lookup failed:", err);
    return null;
  }
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuth();
  const db = getDb();
  const game = getGame(db, parseInt(id));
  if (!game) notFound();

  const reviews = getReviews(db, game.id);
  const elections = getElectionsForGame(db, game.id);
  const gamedb = await fetchGamedb(game);

  // Use gamedb image if local one is missing
  const imageSrc = game.image_url || gamedb?.background_image || "";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 md:p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
          <div className="w-full sm:w-40 h-48 sm:h-56 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center text-5xl shrink-0 overflow-hidden">
            {imageSrc && imageSrc.startsWith("http") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc}
                alt={game.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{imageSrc || "🎮"}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold mb-1 break-words">{game.title}</h1>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {game.platform && (
                    <span className="inline-block px-2 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs rounded">
                      {game.platform}
                    </span>
                  )}
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded ${
                      game.status === "current"
                        ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                        : game.status === "completed"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-[var(--color-warning)]/20 text-[var(--color-warning)]"
                    }`}
                  >
                    {game.status}
                  </span>
                </div>
              </div>
              {game.avg_rating !== null && (
                <div className="text-right shrink-0">
                  <div className="text-3xl font-bold">{game.avg_rating.toFixed(1)}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">avg rating</div>
                </div>
              )}
            </div>
            {(game.description || gamedb?.description) && (
              <p className="text-[var(--color-text-muted)] text-sm mb-3 whitespace-pre-line">
                {game.description || gamedb?.description}
              </p>
            )}
            <p className="text-sm text-[var(--color-text-muted)]">
              Nominated by{" "}
              <span className="text-[var(--color-text)]">{game.nominatorName}</span>
              {game.scheduled_date && ` · Started ${fmtDate(game.scheduled_date)}`}
              {game.completed_date && ` · Completed ${fmtDate(game.completed_date)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Nomination & Election History */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Nomination History</h2>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 md:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-sm">
            <div>
              <div className="text-xs text-[var(--color-text-muted)]">Times nominated</div>
              <div className="text-lg font-semibold">{Math.max(elections.length, 1)}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-muted)]">First nominated</div>
              <div className="text-lg font-semibold">
                {fmtMonth(
                  elections.length > 0
                    ? elections[elections.length - 1].created_at
                    : game.nominated_at
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-muted)]">Last nominated</div>
              <div className="text-lg font-semibold">
                {fmtMonth(
                  elections.length > 0 ? elections[0].created_at : game.nominated_at
                )}
              </div>
            </div>
          </div>

          {elections.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Currently nominated; not yet voted on.
            </p>
          ) : (
            <div className="grid gap-2">
              {elections.map((e) => {
                const won = e.winner_id === game.id;
                return (
                  <Link
                    key={e.id}
                    href={`/elections/${e.id}`}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                      won
                        ? "bg-amber-500/10 border-amber-500/40 hover:border-amber-500"
                        : "bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-primary)]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{e.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {fmtDate(e.created_at)} · {e.ballot_count} voter(s) ·{" "}
                        {e.status}
                      </div>
                    </div>
                    {won && (
                      <span className="text-amber-400 font-medium shrink-0">🏆 Won</span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* External Game Data */}
      {gamedb && (
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Game Info</h2>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 md:p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {gamedb.metacritic_score !== null && (
                <div>
                  <div className="text-xs text-[var(--color-text-muted)]">Metacritic</div>
                  <div className="text-lg font-semibold">{gamedb.metacritic_score}</div>
                </div>
              )}
              {gamedb.opencritic?.score != null && (
                <div>
                  <div className="text-xs text-[var(--color-text-muted)]">OpenCritic</div>
                  <div className="text-lg font-semibold">
                    {Math.round(gamedb.opencritic.score)}
                    {gamedb.opencritic.tier && (
                      <span className="ml-1 text-xs text-[var(--color-text-muted)]">
                        {gamedb.opencritic.tier}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {gamedb.rawg_rating !== null && (
                <div>
                  <div className="text-xs text-[var(--color-text-muted)]">RAWG</div>
                  <div className="text-lg font-semibold">
                    {gamedb.rawg_rating.toFixed(1)}/5
                  </div>
                </div>
              )}
              {gamedb.release_date && (
                <div>
                  <div className="text-xs text-[var(--color-text-muted)]">Released</div>
                  <div className="text-lg font-semibold">{gamedb.release_date}</div>
                </div>
              )}
            </div>

            {gamedb.hltb && (gamedb.hltb.main_story_hours || gamedb.hltb.main_extra_hours || gamedb.hltb.completionist_hours) && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] mb-1">
                  How Long to Beat
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {gamedb.hltb.main_story_hours && (
                    <span>
                      Main: <strong>{gamedb.hltb.main_story_hours}h</strong>
                    </span>
                  )}
                  {gamedb.hltb.main_extra_hours && (
                    <span>
                      +Extras: <strong>{gamedb.hltb.main_extra_hours}h</strong>
                    </span>
                  )}
                  {gamedb.hltb.completionist_hours && (
                    <span>
                      100%: <strong>{gamedb.hltb.completionist_hours}h</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {gamedb.genres.length > 0 && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Genres</div>
                <div className="flex flex-wrap gap-1">
                  {gamedb.genres.map((g) => (
                    <span
                      key={g}
                      className="text-xs px-2 py-0.5 bg-[var(--color-bg)] rounded"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {gamedb.platforms.length > 0 && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Platforms</div>
                <div className="text-sm">{gamedb.platforms.join(", ")}</div>
              </div>
            )}

            {(gamedb.developers.length > 0 || gamedb.publishers.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {gamedb.developers.length > 0 && (
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)]">Developer</div>
                    <div>{gamedb.developers.join(", ")}</div>
                  </div>
                )}
                {gamedb.publishers.length > 0 && (
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)]">Publisher</div>
                    <div>{gamedb.publishers.join(", ")}</div>
                  </div>
                )}
              </div>
            )}

            {Object.keys(gamedb.store_links).length > 0 && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Stores</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(gamedb.store_links).map(([name, url]) => (
                    <a
                      key={name}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded bg-[var(--color-bg)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] transition-colors"
                    >
                      🔗 {name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Reviews — only shown for completed games (where ratings are meaningful) */}
      {(game.status === "completed" || reviews.length > 0) && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Reviews ({reviews.length})
          </h2>

          {game.status === "completed" && <ReviewForm gameId={game.id} />}

          {reviews.length > 0 ? (
            <div className="grid gap-3 mt-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{review.memberAvatar}</span>
                    <span className="font-medium">{review.memberName}</span>
                    <Stars rating={review.rating} />
                    <span className="text-xs text-[var(--color-text-muted)] ml-auto">
                      {fmtDate(review.created_at)}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-[var(--color-text-muted)] ml-9">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 text-center text-[var(--color-text-muted)] mt-4">
              No reviews yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
