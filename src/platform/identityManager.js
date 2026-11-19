/**
 * identityManager.js
 * Durable player identity (the "hybrid guest + claimable account" model).
 *
 * A guest is a persistent `User` row keyed by an opaque `guestToken` that the
 * client stores in localStorage. On every connect the client sends the token in
 * the socket handshake; we resolve the existing User or mint a new one. Later,
 * claiming a real account (Google / email) attaches an `Identity` to the same
 * User and keeps all history.
 *
 * Every function is best-effort: if persistence is disabled or the DB errors,
 * it returns null / no-ops and the caller falls back to socket.id-only identity.
 */

import { randomUUID } from "crypto";
import { prisma, dbEnabled } from "../db.js";

function newGuestToken() {
  return `g_${randomUUID().replace(/-/g, "")}`;
}

function toIdentity(user, token) {
  return {
    userId:      user.id,
    token,
    name:        user.displayName,
    avatarColor: user.avatarColor,
  };
}

/**
 * Resolve a guest User from a token, or create a fresh one.
 * @param {string|null} token
 * @returns {Promise<{userId:string, token:string, name:string, avatarColor:string}|null>}
 */
export async function resolveOrCreateUser(token) {
  if (!dbEnabled || !prisma) return null;

  try {
    if (token) {
      const existing = await prisma.user.findUnique({ where: { guestToken: token } });
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data:  { lastSeenAt: new Date() },
        });
        return toIdentity(existing, token);
      }
    }

    const freshToken = newGuestToken();
    const user = await prisma.user.create({ data: { guestToken: freshToken } });
    console.log(`[identity] minted guest ${user.id}`);
    return toIdentity(user, freshToken);
  } catch (err) {
    console.error("[identity] resolveOrCreateUser failed:", err.message);
    return null;
  }
}

/**
 * Persist the player's chosen display name / avatar color onto their User row.
 * @param {string|undefined} userId
 * @param {{name:string, avatarColor:string}} profile
 */
export async function updateProfile(userId, { name, avatarColor }) {
  if (!dbEnabled || !prisma || !userId) return;

  try {
    await prisma.user.update({
      where: { id: userId },
      data:  { displayName: name, avatarColor, lastSeenAt: new Date() },
    });
  } catch (err) {
    console.error("[identity] updateProfile failed:", err.message);
  }
}
