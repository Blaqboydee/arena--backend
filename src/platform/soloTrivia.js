/**
 * soloTrivia.js
 * Single-player Trivia — play a pack solo, scored on correct + speed, against a
 * global high-score leaderboard. Server-authoritative (the client never sees the
 * answer until it has answered, and timing is measured server-side), so the
 * leaderboard can't be gamed.
 *
 * Sessions live in memory (a solo run is short); only the best score per player
 * is persisted. Best-effort: soft-errors if persistence is off.
 */

import { randomUUID } from "crypto";
import { prisma, dbEnabled } from "../db.js";
import { drawQuestions } from "../games/triviaQuestions.js";

const GAME_TYPE        = "trivia";
const QUESTIONS_PER_RUN = 10;
const QUESTION_TIME_MS  = 15_000;
const SESSION_TTL_MS    = 30 * 60_000;

// sessionId -> { userId, questions, idx, score, correctCount, startedAt, qSentAt, pack }
const sessions = new Map();

function sweep() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions) if (s.startedAt < cutoff) sessions.delete(id);
}

function calcScore(elapsedMs) {
  if (elapsedMs < 3_000) return 1000;
  if (elapsedMs < 8_000) return 750;
  return 500;
}

async function resolveUser(token) {
  if (!token || !dbEnabled || !prisma) return null;
  try { return await prisma.user.findUnique({ where: { guestToken: token } }); }
  catch { return null; }
}

// A question as the client sees it — never includes the answer.
function publicQuestion(session) {
  const q = session.questions[session.idx];
  return {
    index:     session.idx,
    total:     session.questions.length,
    q:         q.q,
    options:   q.options,
    timeLimit: QUESTION_TIME_MS,
  };
}

// ── Start a run ───────────────────────────────────────────────────────────────

export async function startSolo(token, pack) {
  if (!dbEnabled || !prisma) return { ok: false, error: "Solo trivia is unavailable right now." };
  const user = await resolveUser(token);
  if (!user) return { ok: false, error: "No active session. Reload and try again." };

  sweep();
  const questions = drawQuestions(pack || "random", QUESTIONS_PER_RUN, new Set());
  const sessionId = randomUUID();
  const now = Date.now();
  sessions.set(sessionId, {
    userId: user.id, questions, idx: 0, score: 0, correctCount: 0,
    startedAt: now, qSentAt: now, pack: pack || "random",
  });

  return { ok: true, sessionId, total: questions.length, question: publicQuestion(sessions.get(sessionId)) };
}

// ── Answer the current question ───────────────────────────────────────────────

export async function answerSolo(token, sessionId, choice) {
  const session = sessions.get(sessionId);
  if (!session) return { ok: false, error: "Your trivia session expired. Start again." };

  const user = await resolveUser(token);
  if (!user || user.id !== session.userId) {
    return { ok: false, error: "Session mismatch. Start again." };
  }

  const question = session.questions[session.idx];
  const correctIndex = question.answer;

  // choice: 0-3, or -1 for a timeout / no answer.
  const picked = Number.isInteger(choice) ? choice : -1;
  const elapsed = Math.min(Date.now() - session.qSentAt, QUESTION_TIME_MS);
  const correct = picked === correctIndex;
  const points  = correct ? calcScore(elapsed) : 0;

  session.score += points;
  if (correct) session.correctCount += 1;
  session.idx += 1;

  const finished = session.idx >= session.questions.length;

  if (!finished) {
    session.qSentAt = Date.now();
    return {
      ok: true, correct, correctIndex, points,
      score: session.score, index: session.idx - 1, finished: false,
      next: publicQuestion(session),
    };
  }

  // ── Finalize ──
  sessions.delete(sessionId);
  const timeMs = Date.now() - session.startedAt;
  const summary = await recordScore(session, timeMs);

  return {
    ok: true, correct, correctIndex, points,
    score: session.score, index: session.idx - 1, finished: true,
    summary,
    leaderboard: (await getSoloLeaderboard(10)).entries,
  };
}

// ── Persistence + leaderboard ─────────────────────────────────────────────────

async function recordScore(session, timeMs) {
  const base = {
    score:   session.score,
    correct: session.correctCount,
    total:   session.questions.length,
  };
  if (!dbEnabled || !prisma) return { ...base, best: session.score, isNewBest: false, rank: null };

  try {
    const existing = await prisma.soloScore.findUnique({
      where: { userId_gameType: { userId: session.userId, gameType: GAME_TYPE } },
    });
    const isNewBest = !existing || session.score > existing.score;

    if (isNewBest) {
      await prisma.soloScore.upsert({
        where:  { userId_gameType: { userId: session.userId, gameType: GAME_TYPE } },
        create: { userId: session.userId, gameType: GAME_TYPE, pack: session.pack, timeMs, ...base },
        update: { pack: session.pack, timeMs, ...base },
      });
    }

    const best = Math.max(session.score, existing?.score ?? 0);
    const better = await prisma.soloScore.count({
      where: { gameType: GAME_TYPE, score: { gt: best } },
    });
    return { ...base, best, isNewBest, rank: better + 1 };
  } catch (err) {
    console.error("[solo] recordScore failed:", err.message);
    return { ...base, best: session.score, isNewBest: false, rank: null };
  }
}

export async function getSoloLeaderboard(limit = 25) {
  if (!dbEnabled || !prisma) return { ok: true, entries: [] };
  const take = Math.min(Math.max(1, limit | 0), 100);
  try {
    const rows = await prisma.soloScore.findMany({
      where:   { gameType: GAME_TYPE },
      orderBy: { score: "desc" },
      take,
      include: { user: { select: { id: true, displayName: true, avatarColor: true, avatar: true } } },
    });
    const entries = rows.map((r, i) => ({
      rank:        i + 1,
      userId:      r.user.id,
      name:        r.user.displayName,
      avatarColor: r.user.avatarColor,
      avatar:      r.user.avatar,
      score:       r.score,
      correct:     r.correct,
      total:       r.total,
    }));
    return { ok: true, entries };
  } catch (err) {
    console.error("[solo] leaderboard failed:", err.message);
    return { ok: true, entries: [] };
  }
}
