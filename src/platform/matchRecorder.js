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

  const write = prisma.match.create({
    data: {
      gameType: room.gameType,
      roomId:   room.id,
      status,
      endedAt:  new Date(),
      winnerId: winner?.userId ?? null,
      participants: {
        create: participants.map((p) => ({
          userId: p.userId,
          score:  scores[p.socketId] ?? 0,
          result: resultFor(p.socketId),
        })),
      },
    },
  })
    .then(() => console.log(`[match] recorded ${room.gameType} ${room.id} (${status}) — winner ${winner?.userId ?? "draw"}`))
    .catch((err) => console.error("[match] finishMatch failed:", err.message));

  pendingWrites.add(write);
  write.finally(() => pendingWrites.delete(write));
  await write;
}
