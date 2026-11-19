/**
 * statsRoutes.js
 * Read-only REST API for leaderboards and player profiles.
 * Mounted at /api. Degrades gracefully to empty results if persistence is off.
 */

import { Router } from "express";
import { prisma, dbEnabled } from "../db.js";

const router = Router();

const PLAYER_SELECT = {
  id: true, displayName: true, avatarColor: true, avatar: true,
  rating: true, wins: true, losses: true, draws: true, gamesPlayed: true,
};

function withWinRate(p) {
  const played = p.gamesPlayed ?? p.played ?? 0;
  const wins   = p.wins ?? 0;
  return { ...p, winRate: played > 0 ? Math.round((wins / played) * 100) : 0 };
}

// ── GET /api/leaderboard?game=<type|all>&limit=<n> ────────────────────────────
router.get("/leaderboard", async (req, res) => {
  if (!dbEnabled || !prisma) return res.json({ game: "all", players: [] });

  const game  = (req.query.game || "all").toString();
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);

  try {
    let players;
    if (game === "all") {
      const rows = await prisma.user.findMany({
        where:   { gamesPlayed: { gt: 0 } },
        orderBy: [{ rating: "desc" }, { wins: "desc" }, { gamesPlayed: "asc" }],
        take:    limit,
        select:  PLAYER_SELECT,
      });
      players = rows.map(withWinRate);
    } else {
      const rows = await prisma.userGameStat.findMany({
        where:   { gameType: game, played: { gt: 0 } },
        orderBy: [{ wins: "desc" }, { played: "asc" }],
        take:    limit,
        include: { user: { select: { id: true, displayName: true, avatarColor: true, avatar: true, rating: true } } },
      });
      players = rows.map((r) => withWinRate({
        id: r.user.id, displayName: r.user.displayName, avatarColor: r.user.avatarColor, avatar: r.user.avatar,
        rating: r.user.rating, wins: r.wins, losses: r.losses, draws: r.draws, gamesPlayed: r.played,
      }));
    }

    res.json({ game, players: players.map((p, i) => ({ rank: i + 1, ...p })) });
  } catch (err) {
    console.error("[api] leaderboard failed:", err.message);
    res.status(500).json({ error: "leaderboard_failed" });
  }
});

// ── GET /api/users/:id — profile (stats + per-game breakdown + recent matches) ─
router.get("/users/:id", async (req, res) => {
  if (!dbEnabled || !prisma) return res.status(404).json({ error: "not_found" });

  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.params.id },
      select: { ...PLAYER_SELECT, isGuest: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: "not_found" });

    const [gameStats, recent] = await Promise.all([
      prisma.userGameStat.findMany({
        where:   { userId: user.id, played: { gt: 0 } },
        orderBy: { played: "desc" },
      }),
      prisma.matchParticipant.findMany({
        where:   { userId: user.id },
        orderBy: { createdAt: "desc" },
        take:    10,
        select:  { result: true, score: true, ratingDelta: true, createdAt: true,
                   match: { select: { gameType: true, status: true, endedAt: true } } },
      }),
    ]);

    res.json({
      user: withWinRate(user),
      gameStats: gameStats.map((g) => withWinRate({ ...g, gamesPlayed: g.played })),
      recentMatches: recent.map((r) => ({
        gameType: r.match.gameType, result: r.result, score: r.score,
        ratingDelta: r.ratingDelta, status: r.match.status, endedAt: r.match.endedAt,
      })),
    });
  } catch (err) {
    console.error("[api] profile failed:", err.message);
    res.status(500).json({ error: "profile_failed" });
  }
});

// ── GET /api/stats/summary — global totals (for landing/lobby) ────────────────
router.get("/stats/summary", async (_req, res) => {
  if (!dbEnabled || !prisma) return res.json({ totalPlayers: 0, totalMatches: 0 });
  try {
    const [totalPlayers, totalMatches] = await Promise.all([
      prisma.user.count({ where: { gamesPlayed: { gt: 0 } } }),
      prisma.match.count(),
    ]);
    res.json({ totalPlayers, totalMatches });
  } catch (err) {
    console.error("[api] summary failed:", err.message);
    res.json({ totalPlayers: 0, totalMatches: 0 });
  }
});

export default router;
