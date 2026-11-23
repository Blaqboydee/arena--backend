/**
 * dailyChallenge.js
 * The Daily Challenge: one Wordle puzzle per UTC day, the same word for everyone,
 * played solo and server-authoritatively (the client never sees the answer until
 * the board is finished, so the global daily leaderboard can't be gamed).
 *
 * Also owns the daily *streak*: consecutive UTC days a player finished the daily.
 * Best-effort — every export soft-fails to a generic error if persistence is off.
 */

import { prisma, dbEnabled } from "../db.js";
import { ANSWERS, WORD_LENGTH, GUESS_RE, normalizeGuess, gradeGuess } from "../games/wordleCore.js";

export const MAX_ATTEMPTS = 6;
const GAME_TYPE = "wordle";

// Puzzle #1 = 2026-11-23 (UTC), the day the Daily Challenge launched.
// Month is 0-indexed, so 10 = November.
const EPOCH_MS = Date.UTC(2026, 10, 23);

// ── Date helpers (all UTC, so the puzzle flips at the same instant worldwide) ──

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}
function keyToDate(key) {
  return new Date(`${key}T00:00:00.000Z`);
}
function yesterdayKey(key) {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() - 1);
  return todayKey(d);
}
export function puzzleNumber(key) {
  return Math.floor((keyToDate(key).getTime() - EPOCH_MS) / 86_400_000) + 1;
}

// ── Deterministic daily word ──────────────────────────────────────────────────
// Shuffle the answer pool once with a fixed seed, then walk it by puzzle number:
// stable across server restarts, and no repeat for ANSWERS.length days.

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SHUFFLED = seededShuffle(ANSWERS, 0x4152454e); // "AREN"

export function answerForDate(key) {
  const n = puzzleNumber(key);
  const i = ((n % SHUFFLED.length) + SHUFFLED.length) % SHUFFLED.length;
  return SHUFFLED[i];
}

// ── Scoring ───────────────────────────────────────────────────────────────────
// One sortable number so the leaderboard is a single ORDER BY score DESC:
//   solved always beats unsolved, then fewer guesses, then faster.

const TIME_CAP_MS = 600_000; // 10 min soft cap for the tiebreak

export function scoreFor(solved, guessesUsed, timeMs) {
  const capped = Math.min(Math.max(timeMs | 0, 0), TIME_CAP_MS);
  let score = TIME_CAP_MS - capped; // faster → higher (0..600000)
  if (solved) score += 1_000_000 + (MAX_ATTEMPTS - guessesUsed) * 100_000;
  return score;
}

// ── Serialization ─────────────────────────────────────────────────────────────

function publicState(attempt, { reveal } = {}) {
  const guesses = Array.isArray(attempt.guesses) ? attempt.guesses : [];
  return {
    date:        attempt.date,
    number:      puzzleNumber(attempt.date),
    gameType:    attempt.gameType,
    wordLength:  WORD_LENGTH,
    maxAttempts: MAX_ATTEMPTS,
    guesses,                       // [{ word, grade }]
    attempts:    attempt.attempts,
    solved:      attempt.solved,
    finished:    attempt.finished,
    score:       attempt.finished ? attempt.score : undefined,
    timeMs:      attempt.finished ? attempt.timeMs : undefined,
    answer:      reveal && attempt.finished ? attempt.answer : undefined,
  };
}

async function resolveUser(token) {
  if (!token) return null;
  try {
    return await prisma.user.findUnique({ where: { guestToken: token } });
  } catch {
    return null;
  }
}

function emptyStatus(dateKey) {
  return {
    date:        dateKey,
    number:      puzzleNumber(dateKey),
    gameType:    GAME_TYPE,
    wordLength:  WORD_LENGTH,
    maxAttempts: MAX_ATTEMPTS,
    guesses:     [],
    attempts:    0,
    solved:      false,
    finished:    false,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Today's puzzle + this player's progress + streak. */
export async function getDailyStatus(token) {
  const dateKey = todayKey();
  if (!dbEnabled || !prisma) {
    return { ok: true, state: emptyStatus(dateKey), streak: 0, bestStreak: 0, available: false };
  }

  const user = await resolveUser(token);
  if (!user) {
    return { ok: true, state: emptyStatus(dateKey), streak: 0, bestStreak: 0, available: true };
  }

  const attempt = await prisma.dailyResult.findUnique({
    where: { userId_date: { userId: user.id, date: dateKey } },
  });

  return {
    ok:         true,
    available:  true,
    state:      attempt ? publicState(attempt, { reveal: true }) : emptyStatus(dateKey),
    streak:     user.dailyStreak,
    bestStreak: user.bestStreak,
  };
}

/** Submit one guess. Creates the attempt on first guess; finalizes on solve/6th. */
export async function submitDailyGuess(token, rawGuess) {
  const dateKey = todayKey();
  if (!dbEnabled || !prisma) return { ok: false, error: "The daily challenge is unavailable right now." };

  const user = await resolveUser(token);
  if (!user) return { ok: false, error: "No active session. Reload and try again." };

  const guess = normalizeGuess(rawGuess);
  if (!GUESS_RE.test(guess)) return { ok: false, error: "Enter a 5-letter word." };

  const answer = answerForDate(dateKey);

  // Load or start today's attempt.
  let attempt = await prisma.dailyResult.findUnique({
    where: { userId_date: { userId: user.id, date: dateKey } },
  });

  if (attempt?.finished) {
    return { ok: false, error: "You've already finished today's challenge.", state: publicState(attempt, { reveal: true }) };
  }

  if (!attempt) {
    attempt = await prisma.dailyResult.create({
      data: {
        userId:    user.id,
        date:      dateKey,
        gameType:  GAME_TYPE,
        answer,
        guesses:   [],
        attempts:  0,
        startedAt: new Date(),
      },
    });
  }

  const guesses  = Array.isArray(attempt.guesses) ? [...attempt.guesses] : [];
  const grade    = gradeGuess(guess, answer);
  guesses.push({ word: guess, grade });

  const attempts = guesses.length;
  const solved   = guess === answer;
  const finished = solved || attempts >= MAX_ATTEMPTS;

  if (!finished) {
    const updated = await prisma.dailyResult.update({
      where: { id: attempt.id },
      data:  { guesses, attempts },
    });
    return { ok: true, state: publicState(updated, { reveal: false }) };
  }

  // Finalize: score, streak, timing — all in one transaction.
  const timeMs = Math.max(0, Date.now() - new Date(attempt.startedAt).getTime());
  const score  = scoreFor(solved, attempts, timeMs);

  const prevDate = user.lastDailyDate;
  let streak;
  if (prevDate === dateKey)            streak = user.dailyStreak;        // already counted
  else if (prevDate === yesterdayKey(dateKey)) streak = user.dailyStreak + 1;
  else                                 streak = 1;
  const bestStreak = Math.max(user.bestStreak, streak);

  const [finalAttempt] = await prisma.$transaction([
    prisma.dailyResult.update({
      where: { id: attempt.id },
      data:  { guesses, attempts, solved, finished: true, score, timeMs, finishedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data:  { dailyStreak: streak, bestStreak, lastDailyDate: dateKey },
    }),
  ]);

  return {
    ok:         true,
    state:      publicState(finalAttempt, { reveal: true }),
    streak,
    bestStreak,
    rank:       await rankFor(dateKey, score),
  };
}

/** 1-based rank of a given score among today's finished attempts. */
async function rankFor(dateKey, score) {
  try {
    const better = await prisma.dailyResult.count({
      where: { date: dateKey, finished: true, score: { gt: score } },
    });
    return better + 1;
  } catch {
    return null;
  }
}

/** Top finished attempts for a day, newest puzzle by default. */
export async function getDailyLeaderboard(dateKey = todayKey(), limit = 50) {
  if (!dbEnabled || !prisma) return { ok: true, date: dateKey, number: puzzleNumber(dateKey), entries: [] };

  const take = Math.min(Math.max(1, limit | 0), 100);
  try {
    const rows = await prisma.dailyResult.findMany({
      where:   { date: dateKey, finished: true },
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
      solved:      r.solved,
      guesses:     r.attempts,
      timeMs:      r.timeMs,
    }));

    return { ok: true, date: dateKey, number: puzzleNumber(dateKey), entries };
  } catch (err) {
    console.error("[daily] leaderboard failed:", err.message);
    return { ok: true, date: dateKey, number: puzzleNumber(dateKey), entries: [] };
  }
}
