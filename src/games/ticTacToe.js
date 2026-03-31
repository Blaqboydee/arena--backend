/**
 * ticTacToe.js
 * Continuous-mode Tic Tac Toe engine.
 * Rounds restart automatically. Scores accumulate until a player ends the match.
 * 15-second move timer — forfeit round on timeout.
 * Disconnect/refresh — forfeit match win awarded to opponent via handleTttForfeit.
 */

import { getPlayerList } from "../platform/roomManager.js";

const MOVE_TIMEOUT_MS = 15_000;
const RESET_DELAY_MS  = 2_500;
const START_DELAY_MS  = 1_500;

// ── Win patterns ──────────────────────────────────────────────────────────────

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkWinner(board) {
  for (const [a,b,c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a,b,c] };
    }
  }
  return null;
}

function isDraw(board) {
  return board.every((cell) => cell !== null);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOpponent(room, socketId) {
  return room.players.find((p) => p.id !== socketId) ?? null;
}

function isSafe(room) {
  return room.state.ttt !== null && room.players.length === 2;
}

// ── State initialisers ────────────────────────────────────────────────────────

function initMatchState(players) {
  const [p1, p2] = players;
  return {
    scores:    { [p1.id]: 0, [p2.id]: 0 },
    symbols:   { [p1.id]: "X", [p2.id]: "O" },
    firstTurn: p1.id,
    round:     0,
  };
}

function initRoundState(firstTurnId) {
  return {
    board:    Array(9).fill(null),
    turnId:   firstTurnId,
    finished: false,
    timer:    null,
  };
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function clearTimer(room) {
  const timer = room.state.ttt?.round?.timer;
  if (timer) {
    clearTimeout(timer);
    room.state.ttt.round.timer = null;
  }
}

function startTimer(io, room) {
  if (!isSafe(room)) return;

  const { round } = room.state.ttt;
  clearTimer(room);

  round.timer = setTimeout(() => {
    if (!isSafe(room))  return;
    if (round.finished) return;

    const loser  = room.players.find((p) => p.id === round.turnId);
    const winner = getOpponent(room, round.turnId);

    if (!loser || !winner) {
      round.finished = true;
      return;
    }

    console.log(`[ttt] timeout — ${loser.id} forfeits round`);
    endRound(io, room, winner.id, "timeout");
  }, MOVE_TIMEOUT_MS);
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function startTicTacToe(io, room) {
  if (!room.state.ttt) {
    room.state.ttt = {
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

  const { match } = room.state.ttt;
  match.round += 1;

  const firstPlayer = match.round % 2 === 1
    ? room.players.find((p) => p.id === match.firstTurn)
    : room.players.find((p) => p.id !== match.firstTurn);

  if (!firstPlayer) return;

  room.state.ttt.round = initRoundState(firstPlayer.id);
  const { round } = room.state.ttt;

  room.players.forEach((player) => {
    player.emit("ttt_update", {
      board:       round.board,
      turnId:      round.turnId,
      yourSymbol:  match.symbols[player.id],
      scores:      match.scores,
      roundNumber: match.round,
      timeLimit:   MOVE_TIMEOUT_MS,
    });
  });

  console.log(`[ttt] round ${match.round} — ${firstPlayer.id} goes first`);
  startTimer(io, room);
}

// ── Move handler ──────────────────────────────────────────────────────────────

export function handleTttMove(io, socket, room, cellIndex) {
  if (!room.state.ttt) return;

  const { round, match } = room.state.ttt;

  if (!round || round.finished)        return;
  if (socket.id !== round.turnId)      return;
  if (cellIndex < 0 || cellIndex > 8)  return;
  if (round.board[cellIndex] !== null) return;

  clearTimer(room);

  round.board[cellIndex] = match.symbols[socket.id];

  const winResult = checkWinner(round.board);
  const draw      = !winResult && isDraw(round.board);

  if (winResult) {
    const winnerId = Object.entries(match.symbols)
      .find(([, sym]) => sym === winResult.winner)?.[0];
    endRound(io, room, winnerId ?? null, null, winResult.line);
    return;
  }

  if (draw) {
    endRound(io, room, null, "draw");
    return;
  }

  const nextPlayer = getOpponent(room, socket.id);
  if (!nextPlayer) return;
  round.turnId = nextPlayer.id;

  room.players.forEach((player) => {
    player.emit("ttt_update", {
      board:       round.board,
      turnId:      round.turnId,
      yourSymbol:  match.symbols[player.id],
      scores:      match.scores,
      roundNumber: match.round,
      timeLimit:   MOVE_TIMEOUT_MS,
    });
  });

  startTimer(io, room);
}

// ── End round ─────────────────────────────────────────────────────────────────

function endRound(io, room, winnerId, reason, winLine = null) {
  if (!room.state.ttt) return;

  const { round, match } = room.state.ttt;
  round.finished = true;
  clearTimer(room);

  if (winnerId) {
    match.scores[winnerId] = (match.scores[winnerId] ?? 0) + 1;
  }

  const players    = getPlayerList(room);
  const winnerName = winnerId
    ? players.find((p) => p.id === winnerId)?.name ?? "Unknown"
    : null;

  io.to(room.id).emit("ttt_round_result", {
    winnerId,
    winnerName,
    reason,
    winLine,
    board:       round.board,
    scores:      match.scores,
    roundNumber: match.round,
  });

  console.log(`[ttt] round ${match.round} — ${winnerName ?? "draw"} ${reason ? `(${reason})` : ""}`);

  const roundSnapshot = match.round;
  setTimeout(() => {
    if (!isSafe(room)) return;
    if (match.round !== roundSnapshot) return;
    startRound(io, room);
  }, RESET_DELAY_MS);
}

// ── End match (voluntary) ─────────────────────────────────────────────────────

export function handleTttEndMatch(io, socket, room) {
  if (!room.state.ttt) return;

  clearTimer(room);

  if (room.state.ttt.round) {
    room.state.ttt.round.finished = true;
  }

  const { match } = room.state.ttt;
  const players   = getPlayerList(room);
  const [p1, p2]  = room.players;

  let overallWinnerId = null;
  if (match.scores[p1.id] > match.scores[p2.id])      overallWinnerId = p1.id;
  else if (match.scores[p2.id] > match.scores[p1.id]) overallWinnerId = p2.id;

  const winnerName = overallWinnerId
    ? players.find((p) => p.id === overallWinnerId)?.name ?? "Unknown"
    : null;

  io.to(room.id).emit("ttt_match_over", {
    winnerId:    overallWinnerId,
    winnerName,
    scores:      match.scores,
    totalRounds: match.round,
  });

  room.state.ttt = null;
  console.log(`[ttt] match over — ${winnerName ?? "draw"} | ${match.round} rounds`);
}

// ── Forfeit match (disconnect / refresh) ──────────────────────────────────────
// Called by the server's disconnect handler and the /api/rooms/:id/forfeit
// HTTP endpoint. Idempotent — safe to call from both paths without double-firing.
//
// Design: instead of ending mid-round with a confusing partial state,
// we award the full match to the opponent immediately and emit ttt_match_over.
// The disconnecting player is already gone; the opponent sees the result screen.

export function handleTttForfeit(io, room, disconnectedPlayerId) {
  // Idempotency guard — if HTTP beacon already ran, state is null.
  if (!room.state.ttt) return;

  clearTimer(room);

  if (room.state.ttt.round) {
    room.state.ttt.round.finished = true;
  }

  const { match } = room.state.ttt;
  const players   = getPlayerList(room);

  // The opponent is whoever is NOT the disconnecting player.
  const winner = players.find((p) => p.id !== disconnectedPlayerId) ?? null;
  const loser  = players.find((p) => p.id === disconnectedPlayerId) ?? null;

  const winnerId   = winner?.id   ?? null;
  const winnerName = winner?.name ?? null;

  console.log(
    `[ttt] forfeit — ${loser?.id ?? disconnectedPlayerId} disconnected, ` +
    `${winnerName ?? "opponent"} wins room ${room.id}`
  );

  io.to(room.id).emit("ttt_match_over", {
    winnerId,
    winnerName,
    scores:      match.scores,
    totalRounds: match.round,
    reason:      "forfeit", // lets the result screen show a tailored message
  });

  // Null out state so any subsequent calls (beacon race) are no-ops.
  room.state.ttt = null;
}

// ── Cleanup on disconnect ─────────────────────────────────────────────────────
// Used for non-ttt cleanup paths and testing teardown.

export function cleanupTicTacToe(room) {
  if (!room.state.ttt) return;
  clearTimer(room);
  if (room.state.ttt.round) room.state.ttt.round.filled = true;
  room.state.ttt = null;
  console.log(`[ttt] cleaned up room ${room.id}`);
}