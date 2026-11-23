/**
 * triviaRoyale.js
 * Kahoot-style multiplayer trivia. 3–8 players.
 *
 * Host (room creator) picks when to start. Everyone answers timed MCQs.
 * Faster correct answers = more points.
 * Leaderboard shown after each question. 10 questions per match.
 *
 * Scoring:
 *   Correct + fast (< 3s)  → 1000 pts
 *   Correct + medium       → 750 pts
 *   Correct + slow         → 500 pts
 *   Wrong / timeout        → 0 pts
 */

import { getPlayerList } from "../platform/roomManager.js";
import { finishMatch }   from "../platform/matchRecorder.js";
import { drawQuestions } from "./triviaQuestions.js";

const QUESTION_TIME_MS = 15_000;
const REVEAL_DELAY_MS  = 5_000;
const START_DELAY_MS   = 2_000;
const TOTAL_QUESTIONS  = 10;        // default round length
const MIN_QUESTIONS    = 5;
const MAX_QUESTIONS    = 20;

// Clamp a host-chosen question count to a sane range (falls back to the default).
function resolveCount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return TOTAL_QUESTIONS;
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, Math.round(n)));
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function isSafe(room) {
  return room.state.triv !== null && room.players.length >= 2;
}

function clearTimer(room) {
  const timer = room.state.triv?.currentTimer;
  if (timer) {
    clearTimeout(timer);
    room.state.triv.currentTimer = null;
  }
}

/**
 * Validate and sanitise custom questions coming from the client.
 * Returns a normalised array, or null if validation fails.
 */
function validateCustomQuestions(raw) {
  if (!Array.isArray(raw)) return null;
  if (raw.length < 3 || raw.length > 20) return null;

  const validated = [];
  for (const item of raw) {
    if (!item || typeof item.q !== "string") return null;
    const q = item.q.trim().slice(0, 300);
    if (!q) return null;

    if (!Array.isArray(item.options) || item.options.length !== 4) return null;
    const options = item.options.map((o) =>
      typeof o === "string" ? o.trim().slice(0, 200) : ""
    );
    if (options.some((o) => !o)) return null;

    if (typeof item.answer !== "number" || ![0, 1, 2, 3].includes(item.answer)) return null;

    validated.push({ q, options, answer: item.answer });
  }
  return validated;
}

function calcScore(answerTime) {
  if (answerTime < 3000) return 1000;
  if (answerTime < 8000) return 750;
  return 500;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function startTriviaRoyale(io, room, questionConfig) {
  let questions;
  const count = resolveCount(questionConfig?.count);

  // Per-room memory of questions asked this session, so replaying the same pack
  // in the same room serves fresh questions until the pool is exhausted. Lives on
  // the room (not room.state.triv, which is cleared after each match).
  room.trivAsked ??= new Set();

  if (questionConfig?.mode === "custom" && Array.isArray(questionConfig.questions)) {
    const validated = validateCustomQuestions(questionConfig.questions);
    // If validation fails fall back to random so bad input can't crash the match
    questions = validated ?? drawQuestions("random", count, room.trivAsked);
  } else if (questionConfig?.mode === "pack" && questionConfig.pack) {
    questions = drawQuestions(questionConfig.pack, count, room.trivAsked);
  } else {
    questions = drawQuestions("random", count, room.trivAsked);
  }

  room.state.triv = {
    questions,
    currentQ:     0,
    scores:       {},
    answers:      {},     // { [playerId]: { choice, time } } for current question
    currentTimer: null,
    phase:        "starting",   // starting | question | reveal | finished
  };

  // Initialize scores
  room.players.forEach((p) => {
    room.state.triv.scores[p.id] = 0;
  });

  const players = getPlayerList(room);

  io.to(room.id).emit("triv_match_start", {
    totalQuestions: questions.length,
    playerCount:   room.players.length,
    players,
  });

  setTimeout(() => {
    if (!isSafe(room)) return;
    nextQuestion(io, room);
  }, START_DELAY_MS);

  console.log(`[triv] match started — ${room.players.length} players, ${questions.length} questions`);
}

function nextQuestion(io, room) {
  if (!isSafe(room)) return;
  const { triv } = room.state;
  if (!triv) return;

  if (triv.currentQ >= triv.questions.length) {
    endMatch(io, room);
    return;
  }

  const q = triv.questions[triv.currentQ];
  triv.answers = {};
  triv.phase = "question";
  triv.questionStartedAt = Date.now();

  const players = getPlayerList(room);

  io.to(room.id).emit("triv_question", {
    questionNumber: triv.currentQ + 1,
    totalQuestions: triv.questions.length,
    question:       q.q,
    options:        q.options,
    timeLimit:      QUESTION_TIME_MS,
    scores:         triv.scores,
    players,
  });

  // Timeout — reveal answer
  triv.currentTimer = setTimeout(() => {
    if (!room.state.triv || triv.phase !== "question") return;
    revealAnswer(io, room);
  }, QUESTION_TIME_MS);

  console.log(`[triv] Q${triv.currentQ + 1}: "${q.q}"`);
}

// ── Answer handler ────────────────────────────────────────────────────────────

export function handleTrivAnswer(io, socket, room, choice) {
  if (!room.state.triv) return;
  const { triv } = room.state;
  if (triv.phase !== "question") return;

  // Already answered
  if (triv.answers[socket.id]) return;

  // Validate choice
  if (typeof choice !== "number" || choice < 0 || choice >= 4) return;

  triv.answers[socket.id] = {
    choice,
    time: Date.now(),
  };

  // Notify everyone that this player answered (without revealing what)
  const players = getPlayerList(room);
  const answeredCount = Object.keys(triv.answers).length;

  io.to(room.id).emit("triv_player_answered", {
    playerId:      socket.id,
    answeredCount,
    totalPlayers:  room.players.length,
    players,
  });

  // If everyone answered, reveal early
  if (answeredCount >= room.players.length) {
    clearTimer(room);
    revealAnswer(io, room);
  }
}

function revealAnswer(io, room) {
  if (!room.state.triv) return;
  const { triv } = room.state;
  if (triv.phase !== "question") return;

  triv.phase = "reveal";
  clearTimer(room);

  const q = triv.questions[triv.currentQ];
  const correctAnswer = q.answer;

  // Calculate scores for this question
  const playerResults = {};

  room.players.forEach((p) => {
    const answer = triv.answers[p.id];
    let points = 0;
    let correct = false;

    if (answer && answer.choice === correctAnswer) {
      correct = true;
      const elapsed = answer.time - triv.questionStartedAt;
      points = calcScore(Math.max(0, elapsed));
    }

    if (points > 0) {
      triv.scores[p.id] = (triv.scores[p.id] ?? 0) + points;
    }

    playerResults[p.id] = {
      choice:  answer?.choice ?? null,
      correct,
      points,
    };
  });

  const players = getPlayerList(room);

  // Sort leaderboard by score descending
  const leaderboard = players
    .map((p) => ({ ...p, score: triv.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  io.to(room.id).emit("triv_reveal", {
    questionNumber:  triv.currentQ + 1,
    correctAnswer,
    question:        q.q,
    options:         q.options,
    playerResults,
    scores:          triv.scores,
    leaderboard,
    players,
  });

  triv.currentQ += 1;

  // Next question or end
  triv.currentTimer = setTimeout(() => {
    if (!room.state.triv) return;
    nextQuestion(io, room);
  }, REVEAL_DELAY_MS);
}

// ── End match ─────────────────────────────────────────────────────────────────

function endMatch(io, room) {
  if (!room.state.triv) return;
  const { triv } = room.state;
  triv.phase = "finished";
  clearTimer(room);

  const players = getPlayerList(room);
  const leaderboard = players
    .map((p) => ({ ...p, score: triv.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const winnerId   = leaderboard[0]?.id ?? null;
  const winnerName = leaderboard[0]?.name ?? null;

  io.to(room.id).emit("triv_match_over", {
    winnerId,
    winnerName,
    scores:         triv.scores,
    leaderboard,
    totalQuestions: triv.questions.length,
  });

  finishMatch(room, { winnerSocketId: winnerId, scores: triv.scores, status: "completed" });

  room.state.triv = null;
  console.log(`[triv] match over — winner: ${winnerName}`);
}

export function handleTrivEndMatch(io, socket, room) {
  if (!room.state.triv) return;
  endMatch(io, room);
}

// ── Forfeit / disconnect ──────────────────────────────────────────────────────

export function handleTrivForfeit(io, room, disconnectedPlayerId) {
  if (!room.state.triv) return;

  // In trivia, disconnecting just removes you from scoring.
  // If only 1 player left, end the match.
  if (room.players.length < 2) {
    endMatch(io, room);
    return;
  }

  // Otherwise, notify remaining players
  const players = getPlayerList(room);
  io.to(room.id).emit("triv_player_left", {
    playerId: disconnectedPlayerId,
    players,
    remainingCount: room.players.length,
  });
}

export function cleanupTriviaRoyale(room) {
  if (!room.state.triv) return;
  clearTimer(room);
  room.state.triv = null;
  console.log(`[triv] cleaned up room ${room.id}`);
}
