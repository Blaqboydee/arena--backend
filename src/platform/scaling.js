/**
 * scaling.js
 * Optional multi-instance support via the Socket.IO Redis adapter.
 *
 * With REDIS_URL set, broadcasts (io.to(room).emit, lobby counts) propagate
 * across every server instance sharing the same Redis — so you can run more than
 * one instance behind a load balancer. Without it, the server runs single-
 * instance exactly as before.
 *
 * NOTE: the adapter solves *outbound* fan-out across instances. Splitting a
 * single live game across instances (inbound move routing) is a further step —
 * see README "Scaling". This is the foundation that makes that possible.
 *
 * Best-effort: if Redis can't be reached at boot, we log and fall back to
 * single-instance rather than crash.
 */

import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";

function waitReady(client) {
  return new Promise((resolve, reject) => {
    client.once("ready", resolve);
    client.once("error", reject);
  });
}

/**
 * Attach the Redis adapter to an existing Socket.IO server.
 * @returns {Promise<{pubClient: Redis, subClient: Redis} | null>} clients (for shutdown) or null
 */
export async function setupRedisAdapter(io) {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("[scale] REDIS_URL not set — single-instance mode");
    return null;
  }

  const pubClient = new Redis(url, { maxRetriesPerRequest: null });
  const subClient = pubClient.duplicate();

  try {
    await Promise.race([
      Promise.all([waitReady(pubClient), waitReady(subClient)]),
      new Promise((_, rej) => setTimeout(() => rej(new Error("Redis connect timeout")), 10_000)),
    ]);

    io.adapter(createAdapter(pubClient, subClient));

    // Keep transient post-boot errors from crashing the process.
    pubClient.on("error", (e) => console.error("[scale] redis pub error:", e.message));
    subClient.on("error", (e) => console.error("[scale] redis sub error:", e.message));

    console.log("[scale] Redis adapter attached — multi-instance mode enabled");
    return { pubClient, subClient };
  } catch (err) {
    console.error("[scale] Redis adapter setup failed — falling back to single-instance:", err.message);
    pubClient.disconnect();
    subClient.disconnect();
    return null;
  }
}
