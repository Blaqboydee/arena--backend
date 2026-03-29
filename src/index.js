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

// ── Server setup ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ── Game engine router ────────────────────────────────────────────────────────
// When a room is full, kick off the right game engine.

function startGame(room) {
  setRoomStatus(room.id, "in_progress");

  switch (room.gameType) {
    case "reaction":
      startReactionGame(io, room);
      break;
    // case "tictactoe": startTicTacToe(io, room); break;
    // case "hangman":   startHangman(io, room);   break;
    default:
      console.warn(`[server] no engine for gameType: ${room.gameType}`);
  }
}

// ── Shared match-start helper ─────────────────────────────────────────────────

function launchMatch(room) {
  const players = getPlayerList(room);

  // Tell every player in the room who they're playing against
  room.players.forEach((player) => {
    player.emit("match_found", {
      roomId:    room.id,
      gameType:  room.gameType,
      inviteCode: room.inviteCode,
      players,
      yourId:    player.id,
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
  // Client sends this immediately after connect (from useSession in the frontend)
  socket.on("set_session", ({ name, avatarColor }) => {
    setSession(socket, { name, avatarColor });
    console.log(`[session] ${socket.id} → ${name} (${avatarColor})`);
  });

  // ── 2. Lobby ────────────────────────────────────────────────────────────────
  // Client joins the lobby "room" to receive live queue count updates
  socket.on("join_lobby", () => {
    socket.join("lobby");
    // Send current counts immediately so the UI doesn't wait
    socket.emit("lobby_counts", getQueueCounts());
  });

  socket.on("leave_lobby", () => {
    socket.leave("lobby");
  });

  // ── 3. Quick match ──────────────────────────────────────────────────────────
  socket.on("find_match", ({ gameType }) => {
    const result = enqueue(socket, gameType);
    broadcastCounts(io); // update lobby counts for everyone

    if (result.matched) {
      const [p1, p2] = result.players;

      // p1 creates the room, p2 joins it
      const room = createRoom(p1, gameType);
      room.players.push(p2);
      p2.join(room.id);

      broadcastCounts(io); // counts changed again after match
      launchMatch(room);
    }
  });

  socket.on("cancel_match", () => {
    dequeue(socket.id);
    broadcastCounts(io);
  });

  // ── 4. Private room ─────────────────────────────────────────────────────────
  socket.on("create_room", ({ gameType }) => {
    console.log(gameType);
    
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

  // ── 6. Disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id}`);

    // Remove from any matchmaking queue
    const queuedGame = dequeue(socket.id);
    if (queuedGame) broadcastCounts(io);

    // Remove from any active room
    const room = handlePlayerLeave(socket.id);
    if (room) {
      // Notify the remaining player
      if (room.players.length > 0) {
        io.to(room.id).emit("opponent_left", {
          message: "Your opponent disconnected.",
        });
      }
      // Clean up finished or now-empty rooms
      if (room.players.length === 0 || room.status === "finished") {
        removeRoom(room.id);
      }
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(3000, () => {
  console.log("[server] running on port 3000");
});