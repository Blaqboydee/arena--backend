/**
 * roomManager.js
 * Platform-level room management.
 * Rooms are game-agnostic — each room knows its gameType,
 * so any game engine can be plugged in.
 */

import { customAlphabet } from "nanoid";
import { getSession } from "./sessionManager.js";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

/** @type {Map<string, Room>} roomId → Room */
const rooms = new Map();

/** @type {Map<string, string>} inviteCode → roomId */
const inviteCodes = new Map();

/** Max players per game type. Defaults to 2 for unlisted types. */
const MAX_PLAYERS = {
  reaction:       2,
  tictactoe:      2,
  hangman:        2,
  connectfour:    2,
  wordle:         2,
  wouldyourather: 2,
  memoryduel:     2,
  triviaroyale:   8,
  bombdefusal:    4,
};

/** Min players required to start. Defaults to 2. */
const MIN_PLAYERS = {
  triviaroyale: 3,
  bombdefusal:  2,
};

export function getMaxPlayers(gameType) {
  return MAX_PLAYERS[gameType] ?? 2;
}

export function getMinPlayers(gameType) {
  return MIN_PLAYERS[gameType] ?? 2;
}

/**
 * @typedef {Object} Room
 * @property {string}   id
 * @property {string}   gameType   — "reaction" | "tictactoe" | "hangman"
 * @property {"waiting"|"in_progress"|"finished"} status
 * @property {import("socket.io").Socket[]} players
 * @property {string}   inviteCode
 * @property {Object}   state      — owned by the game engine
 */

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Create a new room and have the socket join it.
 * Returns the Room object.
 */
export function createRoom(socket, gameType) {
  const id          = `room_${nanoid()}`;
  const inviteCode  = nanoid();

  const room = {
    id,
    gameType,
    status:     "waiting",
    players:    [socket],
    inviteCode,
    state:      {},
  };

  rooms.set(id, room);
  inviteCodes.set(inviteCode, id);
  socket.join(id);

  console.log(`[room] created ${id} (${gameType}) invite=${inviteCode}`);
  return room;
}

// ── Join ──────────────────────────────────────────────────────────────────────

/**
 * Add a second player to an existing room by invite code.
 * Returns the Room, or null if code is invalid / room is full.
 */
export function joinByInvite(socket, inviteCode) {
  if (!inviteCode) return null;
  const roomId = inviteCodes.get(inviteCode.toUpperCase());
  if (!roomId) return null;

  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.status !== "waiting") return null;
  if (room.players.length >= getMaxPlayers(room.gameType)) return null;

  room.players.push(socket);
  socket.join(room.id);

  console.log(`[room] ${getSession(socket).name} joined ${room.id} via invite`);
  return room;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

export function getRoomByInvite(inviteCode) {
  const roomId = inviteCodes.get(inviteCode?.toUpperCase());
  return roomId ? rooms.get(roomId) : null;
}

// ── Status ────────────────────────────────────────────────────────────────────

export function setRoomStatus(roomId, status) {
  const room = rooms.get(roomId);
  if (room) room.status = status;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function removeRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  inviteCodes.delete(room.inviteCode);
  rooms.delete(roomId);
  console.log(`[room] removed ${roomId}`);
}

/**
 * Remove a player from any room they're in.
 * Returns the affected room (if any) so the caller can handle it.
 */
export function handlePlayerLeave(socketId) {
  for (const [roomId, room] of rooms) {
    const idx = room.players.findIndex((p) => p.id === socketId);
    if (idx !== -1) {
      room.players.splice(idx, 1);
      console.log(`[room] player ${socketId} left ${roomId}`);
      return room;
    }
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the serialisable player list for a room.
 * Safe to emit directly to clients.
 */
export function getPlayerList(room) {
  return room.players.map((p) => getSession(p));
}