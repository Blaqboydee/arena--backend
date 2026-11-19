/**
 * matchRecorder.js
 * Writes a completed (or abandoned) game to the database — one `Match` row plus
 * one `MatchParticipant` per player. This is the data leaderboards, ELO, leagues
 * and tournaments read from.
 *
 * Key detail: it records against the START-OF-MATCH participant snapshot
 * (`room.participants`), NOT `room.players`. On a forfeit the disconnecting
 * player is already spliced out of `room.players`, so the live list can't tell
 * us who the loser was — the snapshot can.
 *
 * Best-effort and record-once:
 *  • no DB / persistence off  → no-op
 *  • already recorded         → no-op (guarded by `room._recorded`)
 *  • DB error                 → logged, swallowed (never breaks gameplay)
 */

import { prisma, dbEnabled } from "../db.js";

// In-flight writes, so graceful shutdown can flush them before the process exits
// (finishMatch is fire-and-forget, so a deploy could otherwise drop a record
// mid-write).
const pendingWrites = new Set();

// 1v1 competitive games that move ELO. Co-op (bomb), social (would-you-rather)
// and multiplayer (trivia) still record stats/history but don't affect rating.
const RANKED_1V1 = new Set(["reaction", "tictactoe", "hangman", "connectfour", "wordle", "memoryduel"]);
const K_FACTOR = 32;
const DEFAULT_RATING = 1000;

/** Await all in-flight match writes. Called during graceful shutdown. */
export async function flushPendingMatches() {
  if (pendingWrites.size === 0) return;
  console.log(`[match] flushing ${pendingWrites.size} pending write(s)…`);
  await Promise.allSettled([...pendingWrites]);
}

/**
 * @param {object} room
 * @param {object} opts
 * @param {string|null} opts.winnerSocketId  in-match socket id of the winner, or null for a draw
 * @param {Record<string, number>} opts.scores  socketId → score
 * @param {"completed"|"abandoned"} [opts.status]
 * @param {"win"|"loss"|null} [opts.coopResult]  co-op games (e.g. Bomb Defusal): every
 *        participant shares this result and there is no single winner.
 */
export async function finishMatch(room, { winnerSocketId = null, scores = {}, status = "completed", coopResult = null } = {}) {
  if (!dbEnabled || !prisma) return;
  if (room._recorded) return;        // record each match exactly once
  room._recorded = true;

  const participants = (room.participants ?? []).filter((p) => p.userId);
  if (participants.length === 0) return;   // nothing persistable (e.g. all guests unresolved)

  const winner = coopResult ? null : (participants.find((p) => p.socketId === winnerSocketId) ?? null);

  const resultFor = (socketId) => {
    if (coopResult)                    return coopResult;   // shared co-op outcome
    if (winnerSocketId == null)        return "draw";
    if (socketId === winnerSocketId)   return "win";
    return status === "abandoned" ? "forfeit" : "loss";
  };

  // Map a match result to stat deltas (forfeit counts as a loss for the record).
  const deltas = (result) => ({
    w: result === "win"  ? 1 : 0,
    d: result === "draw" ? 1 : 0,
    l: result === "loss" || result === "forfeit" ? 1 : 0,
  });

  // ── ELO (ranked 1v1 only) ─────────────────────────────────────────────────
  // Read both current ratings, compute a zero-sum update. Kept outside the
  // transaction (a read); a simultaneous match for the same player is rare.
  let elo = null; // { [userId]: { rating, delta } }
  if (RANKED_1V1.has(room.gameType) && participants.length === 2 && !coopResult) {
    const [pa, pb] = participants;
    const current = await prisma.user.findMany({
      where: { id: { in: [pa.userId, pb.userId] } },
      select: { id: true, rating: true },
    });
    const ra = current.find((u) => u.id === pa.userId)?.rating ?? DEFAULT_RATING;
    const rb = current.find((u) => u.id === pb.userId)?.rating ?? DEFAULT_RATING;
    const resA = resultFor(pa.socketId);
    const sa = resA === "win" ? 1 : resA === "draw" ? 0.5 : 0;
    const ea = 1 / (1 + Math.pow(10, (rb - ra) / 400));
    const da = Math.round(K_FACTOR * (sa - ea));
    elo = {
      [pa.userId]: { rating: ra + da, delta: da },
      [pb.userId]: { rating: rb - da, delta: -da },
    };
  }

  // One transaction: the Match + MatchParticipants, plus denormalized stat bumps
  // on each User and their per-game UserGameStat — so the leaderboard stays a
  // cheap ORDER BY and profiles read a single row.
  const ops = [
    prisma.match.create({
      data: {
        gameType: room.gameType,
        roomId:   room.id,
        status,
        endedAt:  new Date(),
        winnerId: winner?.userId ?? null,
        participants: {
          create: participants.map((p) => ({
            userId:      p.userId,
            score:       scores[p.socketId] ?? 0,
            result:      resultFor(p.socketId),
            ratingDelta: elo?.[p.userId]?.delta ?? null,
          })),
        },
      },
    }),
  ];

  for (const p of participants) {
    const { w, d, l } = deltas(resultFor(p.socketId));
    ops.push(
      prisma.user.update({
        where: { id: p.userId },
        data: {
          gamesPlayed: { increment: 1 },
          wins:   { increment: w },
          draws:  { increment: d },
          losses: { increment: l },
          ...(elo?.[p.userId] ? { rating: elo[p.userId].rating } : {}),
        },
      }),
      prisma.userGameStat.upsert({
        where:  { userId_gameType: { userId: p.userId, gameType: room.gameType } },
        create: { userId: p.userId, gameType: room.gameType, played: 1, wins: w, draws: d, losses: l },
        update: { played: { increment: 1 }, wins: { increment: w }, draws: { increment: d }, losses: { increment: l } },
      }),
    );
  }

  const write = prisma.$transaction(ops)
    .then(() => console.log(`[match] recorded ${room.gameType} ${room.id} (${status}) — winner ${winner?.userId ?? "draw"}`))
    .catch((err) => console.error("[match] finishMatch failed:", err.message));

  pendingWrites.add(write);
  write.finally(() => pendingWrites.delete(write));
  await write;
}
