/**
 * sessionManager.js
 * Attaches player identity (name, avatarColor) to a socket.
 * Any game engine can call getSession(socket) to read player info.
 */

const DEFAULT_COLOR = "amber";

/**
 * Save identity onto the socket itself.
 * We use socket.data so it's scoped to the socket and
 * automatically cleaned up on disconnect.
 */
export function setSession(socket, { name, avatarColor }) {
  socket.data.name        = typeof name === "string" && name.trim()
    ? name.trim().slice(0, 20)
    : "Anonymous";
  socket.data.avatarColor = avatarColor || DEFAULT_COLOR;
}

/**
 * Read identity from a socket.
 * Always returns a valid object — safe to call before set_session.
 */
export function getSession(socket) {
  return {
    id:          socket.id,
    name:        socket.data.name        || "Anonymous",
    avatarColor: socket.data.avatarColor || DEFAULT_COLOR,
  };
}