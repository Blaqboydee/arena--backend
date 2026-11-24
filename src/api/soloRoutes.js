/**
 * soloRoutes.js
 * Single-player mode API. Mounted at /api/solo. Caller identifies with its guest
 * token (bearer header or body), same as the Daily Challenge.
 */

import { Router } from "express";
import { startSolo, answerSolo, getSoloLeaderboard } from "../platform/soloTrivia.js";

const router = Router();

function tokenFrom(req) {
  const auth = req.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return (req.body?.token || req.query?.token || "").toString() || null;
}

// POST /api/solo/trivia/start { pack }
router.post("/trivia/start", async (req, res) => {
  try {
    res.json(await startSolo(tokenFrom(req), req.body?.pack));
  } catch (err) {
    console.error("[solo] start route failed:", err.message);
    res.status(500).json({ ok: false, error: "Could not start solo trivia." });
  }
});

// POST /api/solo/trivia/answer { sessionId, choice }
router.post("/trivia/answer", async (req, res) => {
  try {
    res.json(await answerSolo(tokenFrom(req), req.body?.sessionId, req.body?.choice));
  } catch (err) {
    console.error("[solo] answer route failed:", err.message);
    res.status(500).json({ ok: false, error: "Could not submit your answer." });
  }
});

// GET /api/solo/trivia/leaderboard?limit=n
router.get("/trivia/leaderboard", async (req, res) => {
  try {
    res.json(await getSoloLeaderboard(Number(req.query.limit) || 25));
  } catch (err) {
    console.error("[solo] leaderboard route failed:", err.message);
    res.status(500).json({ ok: false, error: "Could not load the solo leaderboard." });
  }
});

export default router;
