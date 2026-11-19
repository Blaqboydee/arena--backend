/**
 * loadtest.mjs — concurrent-player load test for the Arena server.
 *
 * Spawns N pairs of bot clients that quick-match and play Reaction to completion,
 * measuring connect latency, match throughput, and errors. Point it at a local
 * instance or the live Render URL.
 *
 *   node tools/loadtest.mjs --url http://localhost:3000 --pairs 150
 *   node tools/loadtest.mjs --url https://arena-backend-xx39.onrender.com --pairs 50
 *
 * Flags (or env LOADTEST_URL / LOADTEST_PAIRS):
 *   --url    server URL           (default http://localhost:3000)
 *   --pairs  number of 1v1 pairs  (default 100)  → 2× clients
 *   --ramp   ms between connects   (default 5)    → avoids a thundering herd
 */

import { io } from "socket.io-client";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const URL   = args.url   || process.env.LOADTEST_URL   || "http://localhost:3000";
const PAIRS = Number(args.pairs || process.env.LOADTEST_PAIRS || 100);
const RAMP  = Number(args.ramp  || 5);
const CLIENTS = PAIRS * 2;

const m = { connected: 0, connectErrors: 0, matched: 0, completed: 0, gameErrors: 0 };
const connectLatencies = [];
const matchDurations = [];
const startedAt = Date.now();

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function spawnClient(i) {
  const t0 = Date.now();
  const socket = io(URL, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 20000,
  });
  let roomId = null;
  let matchStart = 0;

  socket.on("connect", () => {
    connectLatencies.push(Date.now() - t0);
    m.connected++;
    socket.emit("set_session", { name: `bot${i}`, avatarColor: "amber" });
    socket.emit("find_match", { gameType: "reaction" });
  });
  socket.on("connect_error", () => { m.connectErrors++; });

  socket.on("match_found", (d) => { roomId = d.roomId; m.matched++; matchStart = Date.now(); });

  socket.on("game_update", (data) => {
    if (data.green && roomId) {
      // human-ish reaction: 40–180ms
      setTimeout(() => socket.emit("click", { roomId }), 40 + Math.random() * 140);
    }
  });

  socket.on("game_result", (d) => {
    if (d.final) {
      matchDurations.push(Date.now() - matchStart);
      m.completed++;            // counts per-client (2 per match)
      socket.disconnect();
    }
  });

  socket.on("error", () => { m.gameErrors++; });
  return socket;
}

console.log(`[loadtest] ${URL} — ${PAIRS} pairs (${CLIENTS} clients), ramp ${RAMP}ms`);

const sockets = [];
for (let i = 0; i < CLIENTS; i++) {
  sockets.push(spawnClient(i));
  if (RAMP) await new Promise((r) => setTimeout(r, RAMP));
}

// Run until matches settle or a hard cap.
const DEADLINE = Date.now() + 45_000;
while (Date.now() < DEADLINE && m.completed < CLIENTS) {
  await new Promise((r) => setTimeout(r, 500));
}

sockets.forEach((s) => s.connected && s.disconnect());

console.log("\n──────── load test results ────────");
console.log(`duration:        ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
console.log(`connected:       ${m.connected}/${CLIENTS}  (errors: ${m.connectErrors})`);
console.log(`matches made:    ${m.matched / 2}`);
console.log(`matches completed: ${m.completed / 2}/${PAIRS}`);
console.log(`connect latency: p50 ${pct(connectLatencies, 50)}ms  p95 ${pct(connectLatencies, 95)}ms  max ${Math.max(0, ...connectLatencies)}ms`);
console.log(`match duration:  p50 ${pct(matchDurations, 50)}ms  p95 ${pct(matchDurations, 95)}ms`);
console.log(`game errors:     ${m.gameErrors}`);
console.log("───────────────────────────────────");
process.exit(0);
