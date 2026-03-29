/**
 * lobbyManager.js
 * Manages matchmaking queues per game type.
 * Broadcasts live queue counts to all clients in the lobby.
 */

/** @type {Map<string, import("socket.io").Socket[]>} gameType → queue */
const queues = new Map();

const GAME_TYPES = ["reaction", "tictactoe", "hangman"];

// Initialise empty queues for every game type
GAME_TYPES.forEach((g) => queues.set(g, []));

// ── Queue operations ──────────────────────────────────────────────────────────

/**
 * Add a socket to the queue for a game type.
 * If two players are now queued, dequeues both and returns them.
 * Returns { matched: true, players: [s1, s2] } or { matched: false }.
 */
export function enqueue(socket, gameType) {
  if (!queues.has(gameType)) {
    console.warn(`[lobby] unknown gameType: ${gameType}`);
    return { matched: false };
  }

  const queue = queues.get(gameType);

  // Prevent duplicate queuing
  if (queue.some((s) => s.id === socket.id)) {
    return { matched: false };
  }

  queue.push(socket);
  console.log(`[lobby] ${socket.id} queued for ${gameType} (queue: ${queue.length})`);

  if (queue.length >= 2) {
    const player1 = queue.shift();
    const player2 = queue.shift();
    return { matched: true, players: [player1, player2] };
  }

  return { matched: false };
}

/**
 * Remove a socket from any queue it's in (on disconnect / cancel).
 */
export function dequeue(socketId) {
  for (const [gameType, queue] of queues) {
    const idx = queue.findIndex((s) => s.id === socketId);
    if (idx !== -1) {
      queue.splice(idx, 1);
      console.log(`[lobby] ${socketId} removed from ${gameType} queue`);
      return gameType;
    }
  }
  return null;
}

// ── Live counts ───────────────────────────────────────────────────────────────

/**
 * Returns current queue lengths for all game types.
 * Shape: { reaction: 1, tictactoe: 0, hangman: 0 }
 */
export function getQueueCounts() {
  const counts = {};
  for (const [gameType, queue] of queues) {
    counts[gameType] = queue.length;
  }
  return counts;
}

/**
 * Broadcast current queue counts to everyone in the lobby room.
 * Call this after any enqueue / dequeue operation.
 */
export function broadcastCounts(io) {
  io.to("lobby").emit("lobby_counts", getQueueCounts());
}