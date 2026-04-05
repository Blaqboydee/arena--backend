import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

// Platform layer
import { setSession, getSession }               from "./platform/sessionManager.js";
import { createRoom, joinByInvite, getRoom,
         removeRoom, handlePlayerLeave,
         getPlayerList, setRoomStatus }          from "./platform/roomManager.js";
import { enqueue, dequeue,
         getQueueCounts, broadcastCounts }       from "./platform/lobbyManager.js";

// Game engines
import { startReactionGame, handleClick }        from "./games/reactionGame.js";
import { startTicTacToe,
         handleTttMove, handleTttEndMatch,
         handleTttForfeit,
         cleanupTicTacToe }                      from "./games/ticTacToe.js";
import { startHangman,
         handleHmSubmitWord, handleHmGuess,
         handleHmGiveHint, handleHmEndMatch,
         handleHmForfeit,
         cleanupHangman }                        from "./games/hangman.js";
import { startConnectFour,
         handleC4Move, handleC4EndMatch,
         handleC4Forfeit,
         cleanupConnectFour }                    from "./games/connectFour.js";
import { startWordleDuel,
         handleWdlGuess, handleWdlEndMatch,
         handleWdlForfeit,
         cleanupWordleDuel }                     from "./games/wordleDuel.js";
import { startWouldYouRather,
         handleWyrChoice, handleWyrEndMatch,
         handleWyrForfeit,
         cleanupWouldYouRather }                 from "./games/wouldYouRather.js";

// ── Server setup ──────────────────────────────────────────────────────────────

const app = express();

const allowedOrigins = [
  "http://localhost:4173",
  "http://localhost:5173",
  "https://arenagameplay.vercel.app"
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin ${origin} is not allowed`));
    }
  },
};

app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: allowedOrigins } });

// ── Forfeit HTTP endpoint (sendBeacon fallback) ───────────────────────────────
// The socket disconnect handler is the primary forfeit mechanism.
// This endpoint exists as a belt-and-suspenders catch for sendBeacon payloads
// that arrive just before or just after the socket disconnect is processed.
// It is intentionally idempotent — if the room is already cleaned up, it no-ops.

app.post("/api/rooms/:roomId/forfeit", (req, res) => {
  const { roomId }  = req.params;
  const { playerId } = req.body ?? {};

  if (!playerId) return res.sendStatus(400);

  const room = getRoom(roomId);

  if (!room) return res.sendStatus(204);

  // Only act if the player is still considered "in" the room.
  const isInRoom = room.players.some((p) => p.id === playerId);
  if (!isInRoom) return res.sendStatus(204);

  console.log(`[forfeit-http] ${playerId} forfeited room ${roomId} via beacon`);

  if (room.gameType === "tictactoe" && room.state.ttt) {
    handleTttForfeit(io, room, playerId);
  } else if (room.gameType === "hangman" && room.state.hm) {
    handleHmForfeit(io, room, playerId);
  } else if (room.gameType === "connectfour" && room.state.c4) {
    handleC4Forfeit(io, room, playerId);
  } else if (room.gameType === "wordle" && room.state.wdl) {
    handleWdlForfeit(io, room, playerId);
  } else if (room.gameType === "wouldyourather" && room.state.wyr) {
    handleWyrForfeit(io, room, playerId);
  } else {
    return res.sendStatus(204);
  }

  res.sendStatus(204);
});

// ── Game engine router ────────────────────────────────────────────────────────

function startGame(room) {
  setRoomStatus(room.id, "in_progress");

  switch (room.gameType) {
    case "reaction":
      startReactionGame(io, room);
      break;
    case "tictactoe":
      startTicTacToe(io, room);
      break;
    case "hangman":
      startHangman(io, room);
      break;
    case "connectfour":
      startConnectFour(io, room);
      break;
    case "wordle":
      startWordleDuel(io, room);
      break;
    case "wouldyourather":
      startWouldYouRather(io, room);
      break;
    default:
      console.warn(`[server] no engine for gameType: ${room.gameType}`);
  }
}

// ── Shared match-start helper ─────────────────────────────────────────────────

function launchMatch(room) {
  const players = getPlayerList(room);

  room.players.forEach((player) => {
    player.emit("match_found", {
      roomId:     room.id,
      gameType:   room.gameType,
      inviteCode: room.inviteCode,
      players,
      yourId:     player.id,
    });
  });

  console.log(
    `[server] match started — ${room.id} (${room.gameType}) ` +
    `${players.map((p) => p.name).join(" vs ")}`
  );

  startGame(room);
}

// ── Socket events ─────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // ── 1. Identity ─────────────────────────────────────────────────────────────
  socket.on("set_session", ({ name, avatarColor }) => {
    setSession(socket, { name, avatarColor });
    console.log(`[session] ${socket.id} → ${name} (${avatarColor})`);
  });

  // ── 2. Lobby ────────────────────────────────────────────────────────────────
  socket.on("join_lobby", () => {
    socket.join("lobby");
    socket.emit("lobby_counts", getQueueCounts());
  });

  socket.on("leave_lobby", () => {
    socket.leave("lobby");
  });

  // ── 3. Quick match ──────────────────────────────────────────────────────────
  socket.on("find_match", ({ gameType }) => {
    const result = enqueue(socket, gameType);
    broadcastCounts(io);

    if (result.matched) {
      const [p1, p2] = result.players;
      const room = createRoom(p1, gameType);
      room.players.push(p2);
      p2.join(room.id);
      broadcastCounts(io);
      launchMatch(room);
    }
  });

  socket.on("cancel_match", () => {
    dequeue(socket.id);
    broadcastCounts(io);
  });

  // ── 4. Private room ─────────────────────────────────────────────────────────
  socket.on("create_room", ({ gameType }) => {
    const room = createRoom(socket, gameType);
    socket.emit("room_created", {
      roomId:     room.id,
      inviteCode: room.inviteCode,
      gameType:   room.gameType,
    });
  });

  socket.on("join_room", ({ inviteCode }) => {
    const room = joinByInvite(socket, inviteCode);

    if (!room) {
      socket.emit("join_error", { message: "Room not found or already started." });
      return;
    }

    if (room.players.length === 2) {
      launchMatch(room);
    }
  });

  // ── 5. In-game events ───────────────────────────────────────────────────────
  socket.on("click", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleClick(io, socket, room);
  });

  // ── 6. Tic Tac Toe events ────────────────────────────────────────────────────
  socket.on("ttt_move", ({ roomId, cellIndex }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleTttMove(io, socket, room, cellIndex);
  });

  socket.on("ttt_end_match", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleTttEndMatch(io, socket, room);
  });

  // ── 8. Hangman events ─────────────────────────────────────────────────────────
  socket.on("hm_submit_word", ({ roomId, word }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleHmSubmitWord(io, socket, room, word);
  });

  socket.on("hm_guess", ({ roomId, letter }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleHmGuess(io, socket, room, letter);
  });

  socket.on("hm_give_hint", ({ roomId, hint }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleHmGiveHint(io, socket, room, hint);
  });

  socket.on("hm_end_match", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleHmEndMatch(io, socket, room);
  });

  // ── 9. Connect Four events ──────────────────────────────────────────────────
  socket.on("c4_move", ({ roomId, col }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleC4Move(io, socket, room, col);
  });

  socket.on("c4_end_match", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleC4EndMatch(io, socket, room);
  });

  // ── 10. Wordle Duel events ──────────────────────────────────────────────────
  socket.on("wdl_guess", ({ roomId, word }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleWdlGuess(io, socket, room, word);
  });

  socket.on("wdl_end_match", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleWdlEndMatch(io, socket, room);
  });

  // ── 11. Would You Rather events ─────────────────────────────────────────────
  socket.on("wyr_choice", ({ roomId, choice }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleWyrChoice(io, socket, room, choice);
  });

  socket.on("wyr_end_match", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleWyrEndMatch(io, socket, room);
  });

  // ── 7. Disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id}`);

    // Remove from matchmaking queue
    const queuedGame = dequeue(socket.id);
    if (queuedGame) broadcastCounts(io);

    // Remove from active room
    const room = handlePlayerLeave(socket.id);
    if (!room) return;

    if (room.gameType === "tictactoe" && room.state.ttt) {
      handleTttForfeit(io, room, socket.id);
    } else if (room.gameType === "hangman" && room.state.hm) {
      handleHmForfeit(io, room, socket.id);
    } else if (room.gameType === "connectfour" && room.state.c4) {
      handleC4Forfeit(io, room, socket.id);
    } else if (room.gameType === "wordle" && room.state.wdl) {
      handleWdlForfeit(io, room, socket.id);
    } else if (room.gameType === "wouldyourather" && room.state.wyr) {
      handleWyrForfeit(io, room, socket.id);
    } else {
      // Non-engine games: notify remaining player as before
      if (room.players.length > 0) {
        io.to(room.id).emit("opponent_left", {
          message: "Your opponent disconnected.",
        });
      }
    }

    if (room.players.length === 0 || room.status === "finished") {
      removeRoom(room.id);
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(3000, () => {
  console.log("[server] running on port 3000");
});