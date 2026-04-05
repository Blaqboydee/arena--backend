/**
 * connectFour.js
 * Classic Connect Four (6 rows × 7 columns).
 * Turn-based, follows Tic-Tac-Toe patterns.
 * First to get 4 in a row (horizontal, vertical, diagonal) wins the round.
 */

import { getPlayerList } from "../platform/roomManager.js";

const ROWS         = 6;
const COLS         = 7;
const TURN_TIME_MS = 20_000;
const RESET_DELAY  = 4_000;
const START_DELAY  = 1_500;

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function isSafe(room) {
  return room.state.c4 !== null && room.players.length === 2;
}

function clearTimer(room) {
  const timer = room.state.c4?.round?.timer;
  if (timer) {
    clearTimeout(timer);
    room.state.c4.round.timer = null;
  }
}

/** Drop a disc into a column. Returns the row it landed in, or -1 if full. */
function dropDisc(board, col, color) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) {
      board[r][col] = color;
      return r;
    }
  }
  return -1;
}

/** Check if placing at (row, col) created a 4-in-a-row. */
function checkWin(board, row, col) {
  const color = board[row][col];
  if (!color) return false;

  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal ↘
    [1, -1],  // diagonal ↙
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    // Forward
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== color) break;
      count++;
    }
    // Backward
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== color) break;
      count++;
    }
    if (count >= 4) return true;
  }
  return false;
}

/** Check if the board is full (draw). */
function isBoardFull(board) {
  return board[0].every((cell) => cell !== null);
}

// ── State ─────────────────────────────────────────────────────────────────────

function initMatchState(players) {
  const [p1, p2] = players;
  return {
    scores:  { [p1.id]: 0, [p2.id]: 0 },
    colors:  { [p1.id]: "red", [p2.id]: "yellow" },
    firstId: p1.id,
    round:   0,
  };
}

function initRoundState(turnId) {
  return {
    board:    emptyBoard(),
    turnId,
    finished: false,
    lastMove: null,       // { row, col, color }
    winCells: null,       // [[r,c], ...] winning 4 cells
    timer:    null,
  };
}

// ── Emit update ───────────────────────────────────────────────────────────────

function emitUpdate(io, room) {
  const { round, match } = room.state.c4;
  const players = getPlayerList(room);

  io.to(room.id).emit("c4_update", {
    board:       round.board,
    turnId:      round.turnId,
    scores:      match.scores,
    colors:      match.colors,
    roundNumber: match.round,
    lastMove:    round.lastMove,
    players,
  });
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function startTurnTimer(io, room) {
  if (!isSafe(room)) return;
  clearTimer(room);

  const { round } = room.state.c4;

  io.to(room.id).emit("c4_timer", { timeLimit: TURN_TIME_MS });

  round.timer = setTimeout(() => {
    if (!isSafe(room)) return;
    if (round.finished) return;

    // Player timed out → switch turn (counts as skipped)
    const other = room.players.find((p) => p.id !== round.turnId);
    if (!other) return;

    round.turnId = other.id;
    emitUpdate(io, room);
    startTurnTimer(io, room);
  }, TURN_TIME_MS);
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function startConnectFour(io, room) {
  if (!room.state.c4) {
    room.state.c4 = {
      match: initMatchState(room.players),
      round: null,
    };
  }

  setTimeout(() => {
    if (!isSafe(room)) return;
    startRound(io, room);
  }, START_DELAY);
}

function startRound(io, room) {
  if (!isSafe(room)) return;

  const { match } = room.state.c4;
  match.round += 1;

  // Alternate who goes first
  const firstTurn = match.round % 2 === 1
    ? match.firstId
    : room.players.find((p) => p.id !== match.firstId)?.id ?? match.firstId;

  room.state.c4.round = initRoundState(firstTurn);

  const players = getPlayerList(room);

  io.to(room.id).emit("c4_round_start", {
    roundNumber: match.round,
    turnId:      firstTurn,
    board:       room.state.c4.round.board,
    scores:      match.scores,
    colors:      match.colors,
    players,
  });

  startTurnTimer(io, room);
  console.log(`[c4] round ${match.round} — first turn: ${firstTurn}`);
}

// ── Move handler ──────────────────────────────────────────────────────────────

export function handleC4Move(io, socket, room, col) {
  if (!room.state.c4) return;
  const { round, match } = room.state.c4;

  if (round.finished)       return;
  if (socket.id !== round.turnId) return;
  if (typeof col !== "number" || col < 0 || col >= COLS) return;

  const color = match.colors[socket.id];
  const row   = dropDisc(round.board, col, color);
  if (row === -1) return; // column full

  clearTimer(room);
  round.lastMove = { row, col, color };

  // Check win
  if (checkWin(round.board, row, col)) {
    round.finished = true;
    round.winCells = getWinCells(round.board, row, col);
    endRound(io, room, socket.id, "connect4");
    return;
  }

  // Check draw
  if (isBoardFull(round.board)) {
    round.finished = true;
    endRound(io, room, null, "draw");
    return;
  }

  // Switch turn
  const other = room.players.find((p) => p.id !== socket.id);
  round.turnId = other.id;

  emitUpdate(io, room);
  startTurnTimer(io, room);
}

/** Get the 4+ winning cells for highlight. */
function getWinCells(board, row, col) {
  const color = board[row][col];
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

  for (const [dr, dc] of directions) {
    const cells = [[row, col]];
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== color) break;
      cells.push([r, c]);
    }
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== color) break;
      cells.push([r, c]);
    }
    if (cells.length >= 4) return cells;
  }
  return [[row, col]];
}

// ── End round ─────────────────────────────────────────────────────────────────

function endRound(io, room, winnerId, reason) {
  if (!room.state.c4) return;
  const { round, match } = room.state.c4;
  round.finished = true;
  clearTimer(room);

  if (winnerId) {
    match.scores[winnerId] = (match.scores[winnerId] ?? 0) + 1;
  }

  const players    = getPlayerList(room);
  const winnerName = winnerId
    ? players.find((p) => p.id === winnerId)?.name ?? "Unknown"
    : null;

  io.to(room.id).emit("c4_round_result", {
    winnerId,
    winnerName,
    reason,
    board:       round.board,
    winCells:    round.winCells,
    scores:      match.scores,
    roundNumber: match.round,
  });

  console.log(`[c4] round ${match.round} — ${winnerName ?? "draw"} (${reason})`);

  const snap = match.round;
  setTimeout(() => {
    if (!isSafe(room)) return;
    if (match.round !== snap) return;
    startRound(io, room);
  }, RESET_DELAY);
}

// ── End match ─────────────────────────────────────────────────────────────────

export function handleC4EndMatch(io, socket, room) {
  if (!room.state.c4) return;
  clearTimer(room);

  if (room.state.c4.round) room.state.c4.round.finished = true;

  const { match } = room.state.c4;
  const [p1, p2]  = room.players;

  let overallWinnerId = null;
  if (match.scores[p1.id] > match.scores[p2.id])      overallWinnerId = p1.id;
  else if (match.scores[p2.id] > match.scores[p1.id]) overallWinnerId = p2.id;

  const players    = getPlayerList(room);
  const winnerName = overallWinnerId
    ? players.find((p) => p.id === overallWinnerId)?.name ?? "Unknown"
    : null;

  io.to(room.id).emit("c4_match_over", {
    winnerId:    overallWinnerId,
    winnerName,
    scores:      match.scores,
    totalRounds: match.round,
  });

  room.state.c4 = null;
  console.log(`[c4] match over — ${winnerName ?? "draw"} | ${match.round} rounds`);
}

// ── Forfeit ───────────────────────────────────────────────────────────────────

export function handleC4Forfeit(io, room, disconnectedPlayerId) {
  if (!room.state.c4) return;
  clearTimer(room);

  if (room.state.c4.round) room.state.c4.round.finished = true;

  const { match } = room.state.c4;
  const players   = getPlayerList(room);
  const winner    = players.find((p) => p.id !== disconnectedPlayerId);

  io.to(room.id).emit("c4_match_over", {
    winnerId:    winner?.id ?? null,
    winnerName:  winner?.name ?? null,
    scores:      match.scores,
    totalRounds: match.round,
    reason:      "forfeit",
  });

  room.state.c4 = null;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function cleanupConnectFour(room) {
  if (!room.state.c4) return;
  clearTimer(room);
  if (room.state.c4.round) room.state.c4.round.finished = true;
  room.state.c4 = null;
  console.log(`[c4] cleaned up room ${room.id}`);
}
