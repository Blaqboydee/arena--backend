/**
 * accountManager.js
 * Account claiming + restore (the "claimable account" half of the hybrid model).
 *
 * A guest is a `User` keyed by a device `guestToken`. Claiming attaches a
 * `password` row in the `Identity` table to that same User and flips
 * `isGuest → false` — all history (rank, ELO, matches) stays on the one User.
 * Restoring on another device verifies the credential and hands that device the
 * User's guestToken, so it "becomes" the same player.
 *
 * Hashing is dependency-free (Node's built-in scrypt) so there's nothing to
 * install or compile on the host. Every function is best-effort: if persistence
 * is off it returns a soft error instead of throwing.
 *
 * Identity row shape for a claimed account:
 *   provider     = "password"
 *   providerId   = username, lower-cased  (unique → one account per handle)
 *   label        = username, as the player typed it (for display)
 *   secret       = scrypt hash of the password
 *   recoveryHash = scrypt hash of the one-time recovery code
 */

import { scryptSync, randomBytes, timingSafeEqual, randomInt } from "crypto";
import { prisma, dbEnabled } from "../db.js";

const PROVIDER = "password";

// ── Validation ────────────────────────────────────────────────────────────────

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 100;

export function validateUsername(raw) {
  if (typeof raw !== "string") return "Enter a username.";
  const u = raw.trim();
  if (u.length < 3)  return "Username must be at least 3 characters.";
  if (u.length > 20) return "Username must be 20 characters or less.";
  if (!USERNAME_RE.test(u)) return "Use only letters, numbers and underscores.";
  return null;
}

export function validatePassword(raw) {
  if (typeof raw !== "string") return "Enter a password.";
  if (raw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (raw.length > PASSWORD_MAX) return "Password is too long.";
  return null;
}

// ── Hashing (scrypt, no dependencies) ─────────────────────────────────────────

function hashSecret(plain) {
  const salt = randomBytes(16);
  const dk   = scryptSync(plain, salt, 64);
  return `s2$${salt.toString("hex")}$${dk.toString("hex")}`;
}

function verifySecret(plain, stored) {
  if (!stored || typeof plain !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "s2") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const dk = scryptSync(plain, salt, expected.length);
    return expected.length === dk.length && timingSafeEqual(expected, dk);
  } catch {
    return false;
  }
}

// Recovery code: ARENA-XXXX-XXXX, no ambiguous chars (0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function genRecoveryCode() {
  const pick = () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  const block = () => Array.from({ length: 4 }, pick).join("");
  return `ARENA-${block()}-${block()}`;
}

// Strip spaces/dashes and upper-case so "arena xxxx xxxx" matches the stored code.
function normalizeCode(raw) {
  return typeof raw === "string" ? raw.replace(/[\s-]/g, "").toUpperCase() : "";
}

function storedCodeForm(code) {
  return normalizeCode(code); // hash the normalized form so input formatting doesn't matter
}

// ── Lightweight brute-force throttle (per key, in-memory) ──────────────────────
// Not a replacement for real rate limiting, but enough to blunt online guessing
// on a single instance. Keyed by caller (socket id or IP).

const attempts = new Map(); // key -> { count, resetAt }
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 60_000;

export function tooManyAttempts(key) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now > rec.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

function clearAttempts(key) {
  attempts.delete(key);
}

// ── Public API ────────────────────────────────────────────────────────────────

function accountPayload(user, token) {
  const pw = (user.identities ?? []).find((i) => i.provider === PROVIDER);
  return {
    userId:      user.id,
    token,
    name:        user.displayName,
    avatarColor: user.avatarColor,
    avatar:      user.avatar ?? "",
    claimed:     Boolean(pw),
    username:    pw?.label ?? null,
  };
}

/**
 * Claim the guest `User` identified by `userId` with a username + password.
 * Returns the one-time recovery code on success (shown once to the player).
 */
export async function claimAccount(userId, username, password) {
  if (!dbEnabled || !prisma) return { ok: false, error: "Accounts are unavailable right now." };
  if (!userId) return { ok: false, error: "No active session to claim." };

  const uErr = validateUsername(username);
  if (uErr) return { ok: false, error: uErr };
  const pErr = validatePassword(password);
  if (pErr) return { ok: false, error: pErr };

  const label = username.trim();
  const handle = label.toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where:   { id: userId },
      include: { identities: { where: { provider: PROVIDER } } },
    });
    if (!user) return { ok: false, error: "No active session to claim." };
    if (user.identities.length > 0) {
      return { ok: false, error: "This device already has a saved account." };
    }

    const taken = await prisma.identity.findUnique({
      where: { provider_providerId: { provider: PROVIDER, providerId: handle } },
    });
    if (taken) return { ok: false, error: "That username is taken." };

    const recoveryCode = genRecoveryCode();

    await prisma.$transaction([
      prisma.identity.create({
        data: {
          provider:     PROVIDER,
          providerId:   handle,
          label,
          secret:       hashSecret(password),
          recoveryHash: hashSecret(storedCodeForm(recoveryCode)),
          userId:       user.id,
        },
      }),
      prisma.user.update({ where: { id: user.id }, data: { isGuest: false } }),
    ]);

    console.log(`[account] claimed ${user.id} as @${handle}`);
    return { ok: true, username: label, recoveryCode };
  } catch (err) {
    // Unique-constraint race: two people grabbed the handle at once.
    if (err?.code === "P2002") return { ok: false, error: "That username is taken." };
    console.error("[account] claim failed:", err.message);
    return { ok: false, error: "Could not save account. Try again." };
  }
}

/**
 * Restore a claimed account on this device. `secret` may be the password OR the
 * one-time recovery code. On success returns the account payload including the
 * User's guestToken so the caller can adopt that identity.
 */
export async function restoreAccount(username, secret) {
  if (!dbEnabled || !prisma) return { ok: false, error: "Accounts are unavailable right now." };
  if (typeof username !== "string" || typeof secret !== "string") {
    return { ok: false, error: "Enter your username and password." };
  }

  const handle = username.trim().toLowerCase();
  if (!handle) return { ok: false, error: "Enter your username." };

  try {
    const identity = await prisma.identity.findUnique({
      where:   { provider_providerId: { provider: PROVIDER, providerId: handle } },
      include: { user: { include: { identities: { where: { provider: PROVIDER } } } } },
    });

    // Same generic error whether the user or the secret is wrong (don't leak which).
    const bad = { ok: false, error: "Wrong username or password." };
    if (!identity || !identity.user) return bad;

    const byPassword = verifySecret(secret, identity.secret);
    const byRecovery = verifySecret(storedCodeForm(secret), identity.recoveryHash);
    if (!byPassword && !byRecovery) return bad;

    const user = identity.user;
    if (!user.guestToken) {
      return { ok: false, error: "This account can't be restored. Contact support." };
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    console.log(`[account] restored @${handle} → ${user.id}${byRecovery ? " (recovery code)" : ""}`);

    return {
      ok:          true,
      viaRecovery: byRecovery,
      identity:    accountPayload(user, user.guestToken),
    };
  } catch (err) {
    console.error("[account] restore failed:", err.message);
    return { ok: false, error: "Could not restore account. Try again." };
  }
}

export { clearAttempts };
