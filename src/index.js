import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

// Platform layer
import { setSession, getSession }               from "./platform/sessionManager.js";
import { createRoom, joinByInvite, getRoom,
         removeRoom, handlePlayerLeave,
         getPlayerList, setRoomStatus,
         getMaxPlayers, getMinPlayers }          from "./platform/roomManager.js";
import { enqueue, dequeue,
         getQueueCounts, broadcastCounts }       from "./platform/lobbyManager.js";
import { resolveOrCreateUser, updateProfile }    from "./platform/identityManager.js";
import { setupRedisAdapter }                      from "./platform/scaling.js";
import { flushPendingMatches }                    from "./platform/matchRecorder.js";
import { prisma }                                 from "./db.js";

// Game engines
import { startReactionGame, handleClick,
         handleReactionForfeit }                  from "./games/reactionGame.js";
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
import { startMemoryDuel,
         handleMemFlip, handleMemEndMatch,
         handleMemForfeit,
         cleanupMemoryDuel }                     from "./games/memoryDuel.js";
import { startTriviaRoyale,
         handleTrivAnswer, handleTrivEndMatch,
         handleTrivForfeit,
         cleanupTriviaRoyale }                   from "./games/triviaRoyale.js";
import { startBombDefusal,
         handleBombAction, handleBombEndMatch,
         handleBombForfeit, handleBombRequestState,
         cleanupBombDefusal }                    from "./games/bombDefusal.js";

// ── Server setup ──────────────────────────────────────────────────────────────

const app = express();

const staticAllowedOrigins = [
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
  "https://arenagameplay.vercel.app"
];

const allowedOrigins = [
  ...new Set(
    [
      ...staticAllowedOrigins,
      ...(process.env.CORS_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ]
  ),
];

const devOriginPatterns = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/,
  /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.(ngrok-free\.app|ngrok-free\.dev)$/,
  /^https:\/\/[a-z0-9-]+\.loca\.lt$/,
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  if (process.env.NODE_ENV !== "production") {
    return devOriginPatterns.some((pattern) => pattern.test(origin));
  }

  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin ${origin} is not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
};

app.use(cors(corsOptions));
app.use(express.json());

// ── Health / wake-up ping ─────────────────────────────────────────────────────
// Clients hit this on app load so Render's cold-start clock begins before the
// user even navigates to the lobby.  Must stay above the socket.io setup.
app.get("/ping", (_req, res) => res.sendStatus(200));

const server = http.createServer(app);

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  LOCKED CONFIG — DO NOT MODIFY                                             ║
// ║  Matches client socket.ts. Changing breaks mobile.                         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Socket CORS policy: origin ${origin} is not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["polling", "websocket"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

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
  } else if (room.gameType === "memoryduel" && room.state.mem) {
    handleMemForfeit(io, room, playerId);
  } else if (room.gameType === "triviaroyale" && room.state.triv) {
    handleTrivForfeit(io, room, playerId);
  } else if (room.gameType === "bombdefusal" && room.state.bomb) {
    handleBombForfeit(io, room, playerId);
  } else {
    return res.sendStatus(204);
  }

  res.sendStatus(204);
});

// ── Game engine router ────────────────────────────────────────────────────────

function startGame(room, config = {}) {
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
    case "memoryduel":
      startMemoryDuel(io, room);
      break;
    case "triviaroyale":
      startTriviaRoyale(io, room, config.questionConfig);
      break;
    case "bombdefusal":
      startBombDefusal(io, room);
      break;
    default:
      console.warn(`[server] no engine for gameType: ${room.gameType}`);
  }
}

// ── Shared match-start helper ─────────────────────────────────────────────────

function launchMatch(room, config = {}) {
  const players = getPlayerList(room);

  // Snapshot participants (socket id → persistent userId) at match start, so the
  // match can be recorded even if a player disconnects before it ends.
  room.participants = room.players.map((p) => ({
    socketId:    p.id,
    userId:      p.data?.userId ?? null,
    name:        p.data?.name ?? "Anonymous",
    avatarColor: p.data?.avatarColor ?? "amber",
  }));

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

  startGame(room, config);
}

// ── Socket events ─────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // ── 0. Persistent identity ───────────────────────────────────────────────────
  // Resolve (or mint) a durable guest User from the handshake token so a
  // returning player keeps the same identity across sessions and devices.
  //
  // Stored as a promise on the socket so set_session can await it: the client
  // fires set_session the instant it connects, which races ahead of this DB
  // round-trip. Without the await, the player's chosen name/color would be
  // dropped (userId isn't known yet) and the guest saved as "Anonymous".
  //
  // Best-effort: if persistence is off the socket still works, keyed on socket.id.
  socket.data.identityReady = resolveOrCreateUser(socket.handshake.auth?.token || null)
    .then((identity) => {
      if (!identity) return;
      socket.data.userId = identity.userId;
      // Prime defaults ONLY if set_session hasn't already set a live choice —
      // never clobber the name/color the player just picked.
      if (!socket.data.name)        socket.data.name        = identity.name;
      if (!socket.data.avatarColor) socket.data.avatarColor = identity.avatarColor;
      socket.emit("identity", {
        userId:      identity.userId,
        token:       identity.token,
        name:        identity.name,
        avatarColor: identity.avatarColor,
      });
    })
    .catch((err) => console.error("[identity] resolve failed:", err.message));

  // ── 1. Identity ─────────────────────────────────────────────────────────────
  socket.on("set_session", async ({ name, avatarColor }) => {
    setSession(socket, { name, avatarColor });
    const profile = getSession(socket);                // sanitised name/color
    await socket.data.identityReady;                   // ensure userId is resolved
    await updateProfile(socket.data.userId, profile);  // no-ops if not persisted
    console.log(`[session] ${socket.id} → ${profile.name} (${profile.avatarColor})`);
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
    // Party / co-op games can't be quick-matched — they require a private room
    if (getMinPlayers(gameType) > 2) {
      socket.emit("join_error", { message: "This game requires a private room. Create one and invite your friends!" });
      return;
    }

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

    const minPlayers = getMinPlayers(room.gameType);
    const maxPlayers = getMaxPlayers(room.gameType);

    if (maxPlayers <= 2 && room.players.length === 2) {
      // Classic 2-player game: auto-start
      launchMatch(room);
    } else {
      // Multi-player room: notify all players of the update
      const players = getPlayerList(room);
      room.players.forEach((p) => {
        p.emit("room_player_update", {
          roomId:     room.id,
          inviteCode: room.inviteCode,
          gameType:   room.gameType,
          players,
          minPlayers,
          maxPlayers,
          canStart:   players.length >= minPlayers,
        });
      });
    }
  });

  // ── 4b. Host starts multi-player game ─────────────────────────────────────
  socket.on("start_game", ({ roomId, questionConfig }) => {
    const room = getRoom(roomId);
    if (!room) return;
    if (room.status !== "waiting") return;
    // Only the host (first player) can start
    if (room.players[0]?.id !== socket.id) return;
    const minPlayers = getMinPlayers(room.gameType);
    if (room.players.length < minPlayers) return;
    launchMatch(room, { questionConfig });
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

  // ── 12. Memory Duel events ──────────────────────────────────────────────────
  socket.on("mem_flip", ({ roomId, cardId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleMemFlip(io, socket, room, cardId);
  });

  socket.on("mem_end_match", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleMemEndMatch(io, socket, room);
  });

  // ── 13. Trivia Royale events ────────────────────────────────────────────────
  socket.on("triv_answer", ({ roomId, choice }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleTrivAnswer(io, socket, room, choice);
  });

  socket.on("triv_end_match", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleTrivEndMatch(io, socket, room);
  });

  // ── 14. Bomb Defusal events ─────────────────────────────────────────────────
  socket.on("bomb_request_state", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleBombRequestState(io, socket, room);
  });
  socket.on("bomb_action", ({ roomId, moduleIndex, data }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleBombAction(io, socket, room, { moduleIndex, data });
  });

  socket.on("bomb_end_match", ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    handleBombEndMatch(io, socket, room);
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
    } else if (room.gameType === "reaction" && room.state.match) {
      handleReactionForfeit(io, room, socket.id);
    } else if (room.gameType === "memoryduel" && room.state.mem) {
      handleMemForfeit(io, room, socket.id);
    } else if (room.gameType === "triviaroyale" && room.state.triv) {
      handleTrivForfeit(io, room, socket.id);
    } else if (room.gameType === "bombdefusal" && room.state.bomb) {
      handleBombForfeit(io, room, socket.id);
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

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

// Attach the Redis adapter (no-op without REDIS_URL) before we accept connections.
const redisClients = await setupRedisAdapter(io);

server.listen(port, host, () => {
  console.log(`[server] running on ${host}:${port}`);
  console.log(`[server] explicit allowed origins: ${allowedOrigins.join(", ") || "none"}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Render (and most hosts) send SIGTERM on deploy, then SIGKILL ~30s later. We use
// that window to tell clients we're restarting (they auto-reconnect), stop taking
// new work, flush in-flight match writes, and close infra cleanly — so a deploy
// no longer silently drops data mid-write.

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} received — graceful shutdown`);

  // Safety net: never hang the platform's kill window.
  const force = setTimeout(() => {
    console.error("[server] forced exit (cleanup took too long)");
    process.exit(1);
  }, 8_000);
  force.unref();

  try {
    io.emit("server_restarting", { message: "Server is updating — reconnecting shortly." });
    io.close();
    server.close();
    await flushPendingMatches();
    if (redisClients) {
      redisClients.pubClient.quit();
      redisClients.subClient.quit();
    }
    if (prisma) await prisma.$disconnect();
    console.log("[server] shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("[server] shutdown error:", err.message);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));