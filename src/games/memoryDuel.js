/**
 * memoryDuel.js
 * Competitive card-matching (Memory / Concentration).
 *
 * 4×4 grid of 8 pairs (16 cards). Players take turns flipping 2 cards.
 * Match a pair → keep it + go again. Mismatch → cards flip back, turn passes.
 * Game ends when all pairs are found. Most pairs wins.
 *
 * Timers:
 *   Flip timeout  — 10 s per flip
 *   Reveal delay  — 1.2 s (how long mismatched cards stay visible)
 */

import { getPlayerList } from "../platform/roomManager.js";

const START_DELAY_MS   = 1_500;
const FLIP_TIMEOUT_MS  = 10_000;
const REVEAL_DELAY_MS  = 1_200;
const RESET_DELAY_MS   = 4_000;

const EMOJIS = [
  "🐶", "🐱", "🐸", "🦊", "🐻", "🐼", "🐨", "🦁",
  "🐯", "🐮", "🐷", "🐵", "🐔", "🐧", "🐙", "🦋",
  "🌻", "🍄", "🌈", "⭐", "🔥", "💎", "🎯", "🎲",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSafe(room) {
  return room.state.mem !== null && room.players.length === 2;
}

function clearTimer(room) {
  const timer = room.state.mem?.round?.timer;
  if (timer) {
    clearTimeout(timer);
    room.state.mem.round.timer = null;
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildBoard() {
  const picked = shuffle(EMOJIS).slice(0, 8);
  const pairs  = shuffle([...picked, ...picked]);
  return pairs.map((emoji, i) => ({
    id:       i,
    emoji,
    flipped:  false,
    matched:  false,
  }));
}

// ── State ─────────────────────────────────────────────────────────────────────

function initMatchState(players) {
  const [p1, p2] = players;
  return {
    scores:    { [p1.id]: 0, [p2.id]: 0 },
    round:     0,
    firstTurn: p1.id,
  };
}

function initRoundState(firstTurnId, board) {
  return {
    board,
    turnId:      firstTurnId,
    flippedIds:  [],       // currently flipped (0, 1, or 2 card indices)
    pairs:       {},       // { [playerId]: count }
    totalPairs:  8,
    finished:    false,
    timer:       null,
  };
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function startFlipTimer(io, room) {
  if (!isSafe(room)) return;
  clearTimer(room);

  const { round } = room.state.mem;

  round.timer = setTimeout(() => {
    if (!isSafe(room)) return;
    if (round.finished) return;

    // Current player timed out — switch turns
    const nextPlayer = room.players.find((p) => p.id !== round.turnId);
    if (!nextPlayer) return;

    round.flippedIds = [];
    round.turnId = nextPlayer.id;

    emitUpdate(io, room, null, "timeout");
    startFlipTimer(io, room);
  }, FLIP_TIMEOUT_MS);
}

// ── Emit ──────────────────────────────────────────────────────────────────────

function emitUpdate(io, room, revealCards = null, reason = null) {
  const { round, match } = room.state.mem;
  const players = getPlayerList(room);

  // Build the client-safe board (hide emoji of non-flipped, non-matched cards)
  const clientBoard = round.board.map((card) => ({
    id:      card.id,
    flipped: card.flipped || card.matched,
    matched: card.matched,
    emoji:   (card.flipped || card.matched) ? card.emoji : null,
  }));

  io.to(room.id).emit("mem_update", {
    board:       clientBoard,
    turnId:      round.turnId,
    pairs:       round.pairs,
    scores:      match.scores,
    roundNumber: match.round,
    players,
    revealCards,   // temporarily revealed card ids + emojis (for mismatch animation)
    reason,
    timeLimit:   FLIP_TIMEOUT_MS,
  });
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function startMemoryDuel(io, room) {
  if (!room.state.mem) {
    room.state.mem = {
      match: initMatchState(room.players),
      round: null,
    };
  }

  setTimeout(() => {
    if (!isSafe(room)) return;
    startRound(io, room);
  }, START_DELAY_MS);
}

function startRound(io, room) {
  if (!isSafe(room)) return;

  const { match } = room.state.mem;
  match.round += 1;

  const firstPlayer = match.round % 2 === 1
    ? room.players.find((p) => p.id === match.firstTurn)
    : room.players.find((p) => p.id !== match.firstTurn);

  if (!firstPlayer) return;

  const board = buildBoard();

  room.state.mem.round = initRoundState(firstPlayer.id, board);
  room.state.mem.round.pairs = {
    [room.players[0].id]: 0,
    [room.players[1].id]: 0,
  };

  const players = getPlayerList(room);

  io.to(room.id).emit("mem_round_start", {
    roundNumber: match.round,
    turnId:      firstPlayer.id,
    scores:      match.scores,
    players,
    timeLimit:   FLIP_TIMEOUT_MS,
  });

  emitUpdate(io, room);
  startFlipTimer(io, room);

  console.log(`[mem] round ${match.round} — ${firstPlayer.id} goes first`);
}

// ── Flip handler ──────────────────────────────────────────────────────────────

export function handleMemFlip(io, socket, room, cardId) {
  if (!room.state.mem) return;
  const { round } = room.state.mem;

  if (round.finished) return;
  if (socket.id !== round.turnId) return;
  if (typeof cardId !== "number" || cardId < 0 || cardId >= 16) return;

  const card = round.board[cardId];
  if (!card || card.matched || card.flipped) return;

  // Can only flip if 0 or 1 cards are currently flipped
  if (round.flippedIds.length >= 2) return;

  clearTimer(room);

  card.flipped = true;
  round.flippedIds.push(cardId);

  if (round.flippedIds.length === 1) {
    // First card flipped — show it, wait for second
    emitUpdate(io, room);
    startFlipTimer(io, room);
    return;
  }

  // Second card flipped — check for match
  const [id1, id2] = round.flippedIds;
  const card1 = round.board[id1];
  const card2 = round.board[id2];

  if (card1.emoji === card2.emoji) {
    // Match found!
    card1.matched = true;
    card2.matched = true;
    round.pairs[socket.id] = (round.pairs[socket.id] ?? 0) + 1;
    round.flippedIds = [];

    // Check if all pairs found
    const totalMatched = Object.values(round.pairs).reduce((a, b) => a + b, 0);

    if (totalMatched >= round.totalPairs) {
      endRound(io, room);
      return;
    }

    // Same player goes again
    emitUpdate(io, room);
    startFlipTimer(io, room);
  } else {
    // Mismatch — reveal briefly then flip back
    emitUpdate(io, room, [
      { id: id1, emoji: card1.emoji },
      { id: id2, emoji: card2.emoji },
    ]);

    setTimeout(() => {
      if (!isSafe(room) || round.finished) return;

      card1.flipped = false;
      card2.flipped = false;
      round.flippedIds = [];

      // Switch turns
      const nextPlayer = room.players.find((p) => p.id !== socket.id);
      if (!nextPlayer) return;
      round.turnId = nextPlayer.id;

      emitUpdate(io, room);
      startFlipTimer(io, room);
    }, REVEAL_DELAY_MS);
  }
}

// ── End round ─────────────────────────────────────────────────────────────────

function endRound(io, room) {
  if (!room.state.mem) return;
  const { round, match } = room.state.mem;

  round.finished = true;
  clearTimer(room);

  // Determine round winner by pairs
  const [p1, p2] = room.players;
  const p1Pairs = round.pairs[p1.id] ?? 0;
  const p2Pairs = round.pairs[p2.id] ?? 0;

  let winnerId = null;
  if (p1Pairs > p2Pairs) winnerId = p1.id;
  else if (p2Pairs > p1Pairs) winnerId = p2.id;

  if (winnerId) {
    match.scores[winnerId] = (match.scores[winnerId] ?? 0) + 1;
  }

  const players    = getPlayerList(room);
  const winnerName = winnerId
    ? players.find((p) => p.id === winnerId)?.name ?? "Unknown"
    : null;

  // Show full board
  const fullBoard = round.board.map((card) => ({
    id:      card.id,
    emoji:   card.emoji,
    flipped: true,
    matched: card.matched,
  }));

  io.to(room.id).emit("mem_round_result", {
    winnerId,
    winnerName,
    pairs:       round.pairs,
    scores:      match.scores,
    roundNumber: match.round,
    board:       fullBoard,
  });

  console.log(`[mem] round ${match.round} — winner: ${winnerName ?? "draw"}`);

  const snap = match.round;
  setTimeout(() => {
    if (!isSafe(room)) return;
    if (room.state.mem?.match.round !== snap) return;
    startRound(io, room);
  }, RESET_DELAY_MS);
}

// ── End match ─────────────────────────────────────────────────────────────────

export function handleMemEndMatch(io, socket, room) {
  if (!room.state.mem) return;
  clearTimer(room);

  if (room.state.mem.round) room.state.mem.round.finished = true;

  const { match } = room.state.mem;
  const [p1, p2]  = room.players;

  let overallWinnerId = null;
  if (match.scores[p1.id] > match.scores[p2.id])      overallWinnerId = p1.id;
  else if (match.scores[p2.id] > match.scores[p1.id]) overallWinnerId = p2.id;

  const players    = getPlayerList(room);
  const winnerName = overallWinnerId
    ? players.find((p) => p.id === overallWinnerId)?.name ?? null
    : null;

  io.to(room.id).emit("mem_match_over", {
    winnerId:    overallWinnerId,
    winnerName,
    scores:      match.scores,
    totalRounds: match.round,
  });

  room.state.mem = null;
  console.log(`[mem] match over — ${winnerName ?? "draw"}`);
}

// ── Forfeit ───────────────────────────────────────────────────────────────────

export function handleMemForfeit(io, room, disconnectedPlayerId) {
  if (!room.state.mem) return;
  clearTimer(room);

  if (room.state.mem.round) room.state.mem.round.finished = true;

  const { match }  = room.state.mem;
  const players    = getPlayerList(room);
  const winner     = players.find((p) => p.id !== disconnectedPlayerId) ?? null;
  const loser      = players.find((p) => p.id === disconnectedPlayerId) ?? null;

  io.to(room.id).emit("mem_match_over", {
    winnerId:    winner?.id ?? null,
    winnerName:  winner?.name ?? null,
    scores:      match.scores,
    totalRounds: match.round,
    forfeit:     true,
    forfeitedBy: loser?.name ?? "Opponent",
  });

  room.state.mem = null;
  console.log(`[mem] forfeit — ${disconnectedPlayerId} left`);
}

export function cleanupMemoryDuel(room) {
  if (!room.state.mem) return;
  clearTimer(room);
  if (room.state.mem.round) room.state.mem.round.finished = true;
  room.state.mem = null;
  console.log(`[mem] cleaned up room ${room.id}`);
}
