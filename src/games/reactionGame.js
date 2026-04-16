export function startReactionGame(io, room) {
  const { id: roomId } = room;


  if (!room.state.match) {
  room.state.match = {
    scores: {},
    round: 1,
    maxWins: 2,
    finished: false,
  };

  // initialize scores
  room.players.forEach((p) => {
    room.state.match.scores[p.id] = 0;
  });
}

  if (room.state.match.finished) return;

room.state.round = {
  started: false,
  startTime: null,
  clicks: {},
  finished: false,
};

  // tell players to wait
  io.to(roomId).emit("game_update", {
    message: "Wait for green...",
  });

  // random delay (2–5 sec)
  const delay = Math.random() * 3000 + 2000;

  setTimeout(() => {
    if (room.state.match?.finished || room.players.length < 2) return;
    room.state.round.started = true;
    room.state.round.startTime = Date.now();

    io.to(roomId).emit("game_update", {
      message: "CLICK NOW!",
      green: true,
    });
  }, delay);
}

export function handleClick(io, socket, room) {
  const { id: roomId } = room;
  const round = room.state.round;
  const match = room.state.match;

  if (round.finished) return;

  const now = Date.now();

  // early click = lose round
  if (!round.started) {
    round.finished = true;

    const opponent = room.players.find(p => p.id !== socket.id);
    if (!opponent) return;

    match.scores[opponent.id]++;

    return checkMatchEnd(io, room, opponent.id, "Too early!");
  }

  const reactionTime = now - round.startTime;
  round.clicks[socket.id] = reactionTime;

  if (Object.keys(round.clicks).length === 2) {
    round.finished = true;

    const entries = Object.entries(round.clicks);

    const winner =
      entries[0][1] < entries[1][1]
        ? entries[0][0]
        : entries[1][0];

    match.scores[winner]++;

    checkMatchEnd(io, room, winner);
  }
}

function checkMatchEnd(io, room, winnerId, reason = null) {
  const { id: roomId } = room;
  const match = room.state.match;

  // check if someone won match
  if (match.scores[winnerId] >= match.maxWins) {
    io.to(roomId).emit("game_result", {
      winner: winnerId,
      final: true,
      scores: match.scores,
      reason,
    });

    // reset match for future (optional)
    room.state.match = null;

    return;
  }

  // next round
  match.round++;

  io.to(roomId).emit("game_result", {
    winner: winnerId,
    final: false,
    scores: match.scores,
    reason,
  });

  // start next round after short delay
  setTimeout(() => {
    if (match.finished || room.players.length < 2) return;
    startReactionGame(io, room);
  }, 2000);
}

// ── Forfeit ───────────────────────────────────────────────────────────────────

export function handleReactionForfeit(io, room, disconnectedPlayerId) {
  if (!room.state.match) return;

  room.state.match.finished = true;
  if (room.state.round) room.state.round.finished = true;

  const players = room.players;
  const winner = players.find((p) => p.id !== disconnectedPlayerId);

  if (winner) {
    io.to(room.id).emit("game_result", {
      winner: winner.id,
      final: true,
      scores: room.state.match.scores,
      reason: "opponent_left",
    });
  }

  room.state.match = null;
  console.log(`[reaction] forfeit — ${disconnectedPlayerId} left`);
}

export function cleanupReactionGame(room) {
  if (!room.state.match) return;
  room.state.match.finished = true;
  if (room.state.round) room.state.round.finished = true;
  room.state.match = null;
  console.log(`[reaction] cleaned up room ${room.id}`);
}