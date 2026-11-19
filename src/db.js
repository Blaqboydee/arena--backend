/**
 * db.js
 * Single Prisma client for the whole server.
 *
 * Persistence is OPTIONAL by design: if DATABASE_URL is not set the server runs
 * in "ephemeral mode" — every game still works exactly as before, but identity
 * and match history are not saved. This keeps local dev friction-free and means
 * a database outage degrades gracefully instead of taking the app down.
 *
 * The @prisma/client import is dynamic so the server can boot even before
 * `prisma generate` has been run (e.g. a fresh clone with no DB configured).
 */

export const dbEnabled = Boolean(process.env.DATABASE_URL);

/** @type {import("@prisma/client").PrismaClient | null} */
export let prisma = null;

if (dbEnabled) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    console.log("[db] persistence enabled (Postgres)");
  } catch (err) {
    console.error(
      "[db] DATABASE_URL is set but Prisma client failed to load — " +
      "did you run `npm run db:generate`? Falling back to ephemeral mode.\n     ",
      err.message
    );
    prisma = null;
  }
} else {
  console.warn("[db] DATABASE_URL not set — running in ephemeral mode (no persistence)");
}
