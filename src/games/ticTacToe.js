/**
 * ticTacToe.js
 * Continuous-mode Tic Tac Toe engine.
 * Rounds restart automatically. Scores accumulate until a player ends the match.
 * 15-second move timer — forfeit round on timeout.
 */

import { getSession } from "../platform/sessionManager.js";
import { getPlayerList } from "../platform/roomManager.js";

const MOVE_TIMEOUT_MS = 15_000;
const RESET_DELAY_MS  = 2_000;

// ── Win patterns ──────────────────────────────────────────────────────────────

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6],         // diags
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

// ── State initialiser ─────────────────────────────────────────────────────────

function initMatchState(players) {
  const [p1, p2] = players;
  return {
    scores:    { [p1.id]: 0, [p2.id]: 0 },
    // Symbols assigned once per match, stay for all rounds
    symbols:   { [p1.id]: "X", [p2.id]: "O" },
    // X always goes first in every round
    firstTurn: p1.id,
    round:     0,
  };
}

function initRoundState(firstTurnId) {
  return {
    board:      Array(9).fill(null),
    turnId:     firstTurnId,  // socket id of player whose turn it is
    finished:   false,
    timer:      null,         // setTimeout handle
  };
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function startTicTacToe(io, room) {
  // Initialise match state once
  if (!room.state.ttt) {
    room.state.ttt = {
      match: initMatchState(room.players),
      round: null,
    };
  }

  // Delay the first round so clients have time to navigate to /game
  // and register their ttt_update socket listener before it fires.
  setTimeout(() => startRound(io, room), 1500);
}

function startRound(io, room) {
  const { match } = room.state.ttt;
  match.round += 1;

  // Alternate who goes first each round
  const firstTurnId = match.round % 2 === 1
    ? match.firstTurn
    : room.players.find((p) => p.id !== match.firstTurn).id;

  room.state.ttt.round = initRoundState(firstTurnId);

  const { round } = room.state.ttt;

  // Tell both players the initial state
  room.players.forEach((player) => {
    player.emit("ttt_update", {
      board:      round.board,
      turnId:     round.turnId,
      yourSymbol: match.symbols[player.id],
      scores:     match.scores,
      timeLimit:  MOVE_TIMEOUT_MS,
    });
  });

  console.log(`[ttt] room ${room.id} round ${match.round} started — ${round.turnId} goes first`);
  startTimer(io, room);
}

// ── Move timer ────────────────────────────────────────────────────────────────

function startTimer(io, room) {
  const { round, match } = room.state.ttt;

  clearTimer(room);

  round.timer = setTimeout(() => {
    if (!room.state.ttt)       return; // match was cleaned up
    if (round.finished)        return;

    // Guard: need exactly 2 players still connected
    if (room.players.length < 2) {
      round.finished = true;
      return;
    }

    const loserId  = round.turnId;
    const winner   = room.players.find((p) => p.id !== loserId);

    if (!winner) {
      // Can't determine winner — abort silently
      round.finished = true;
      return;
    }

    console.log(`[ttt] timeout — ${loserId} forfeits round`);
    endRound(io, room, winner.id, "timeout");
  }, MOVE_TIMEOUT_MS);
}

function clearTimer(room) {
  if (room.state.ttt?.round?.timer) {
    clearTimeout(room.state.ttt.round.timer);
    room.state.ttt.round.timer = null;
  }
}

// ── Handle move ───────────────────────────────────────────────────────────────

export function handleTttMove(io, socket, room, cellIndex) {
  const { round, match } = room.state.ttt;

  // Guard checks
  if (!round || round.finished)          return;
  if (socket.id !== round.turnId)        return; // not your turn
  if (cellIndex < 0 || cellIndex > 8)   return;
  if (round.board[cellIndex] !== null)   return; // cell taken

  clearTimer(room);

  // Apply move
  round.board[cellIndex] = match.symbols[socket.id];

  // Check outcome
  const winResult = checkWinner(round.board);
  const draw      = !winResult && isDraw(round.board);

  if (winResult) {
    // Find socket id of the winner by symbol
    const winnerId = Object.entries(match.symbols)
      .find(([, sym]) => sym === winResult.winner)?.[0];
    endRound(io, room, winnerId, null, winResult.line);
    return;
  }

  if (draw) {
    endRound(io, room, null, "draw");
    return;
  }

  // Switch turn
  round.turnId = room.players.find((p) => p.id !== socket.id).id;

  // Broadcast updated board
  room.players.forEach((player) => {
    player.emit("ttt_update", {
      board:      round.board,
      turnId:     round.turnId,
      yourSymbol: match.symbols[player.id],
      scores:     match.scores,
      timeLimit:  MOVE_TIMEOUT_MS,
    });
  });

  startTimer(io, room);
}

// ── End round ─────────────────────────────────────────────────────────────────

function endRound(io, room, winnerId, reason, winLine = null) {
  const { round, match } = room.state.ttt;

  round.finished = true;
  clearTimer(room);

  // Update scores
  if (winnerId) {
    match.scores[winnerId] = (match.scores[winnerId] ?? 0) + 1;
  }

  const players    = getPlayerList(room);
  const winnerName = winnerId
    ? players.find((p) => p.id === winnerId)?.name ?? "Unknown"
    : null;

  // Emit round result to all players
  io.to(room.id).emit("ttt_round_result", {
    winnerId,
    winnerName,
    reason,        // "draw" | "timeout" | null
    winLine,       // [a,b,c] indices | null
    board:         round.board,
    scores:        match.scores,
  });

  console.log(
    `[ttt] round ${match.round} ended — ` +
    `${winnerName ?? "draw"} ${reason ? `(${reason})` : ""}`
  );

  // Auto-restart next round after delay
  setTimeout(() => {
    if (room.state.ttt) startRound(io, room);
  }, RESET_DELAY_MS);
}

// ── Cleanup (call on disconnect) ──────────────────────────────────────────────

export function cleanupTicTacToe(room) {
  if (!room.state.ttt) return;
  clearTimer(room);
  if (room.state.ttt.round) {
    room.state.ttt.round.finished = true;
  }
  room.state.ttt = null;
  console.log(`[ttt] cleaned up room ${room.id}`);
}

export function handleTttEndMatch(io, socket, room) {
  if (!room.state.ttt) return;

  clearTimer(room);
  room.state.ttt.round.finished = true;

  const { match } = room.state.ttt;
  const players   = getPlayerList(room);

  // Determine overall winner by score
  const [p1, p2]  = room.players;
  let overallWinnerId = null;

  if (match.scores[p1.id] > match.scores[p2.id]) {
    overallWinnerId = p1.id;
  } else if (match.scores[p2.id] > match.scores[p1.id]) {
    overallWinnerId = p2.id;
  }
  // If equal — draw, overallWinnerId stays null

  const winnerName = overallWinnerId
    ? players.find((p) => p.id === overallWinnerId)?.name ?? "Unknown"
    : null;

  io.to(room.id).emit("ttt_match_over", {
    winnerId:    overallWinnerId,
    winnerName,
    scores:      match.scores,
    totalRounds: match.round,
  });

  // Clean up
  room.state.ttt = null;

  console.log(
    `[ttt] match ended in room ${room.id} — ` +
    `${winnerName ?? "draw"} wins overall`
  );
}