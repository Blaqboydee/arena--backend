/**
 * dailyRoutes.js
 * REST API for the Daily Challenge. Mounted at /api/daily.
 *
 * The caller identifies itself with its guest token (the same opaque secret used
 * in the socket handshake), passed as a bearer header or `token` field — never a
 * user id, which would be spoofable. Degrades gracefully if persistence is off.
 */

import { Router } from "express";
import {
  getDailyStatus, submitDailyGuess, getDailyLeaderboard, todayKey,
} from "../platform/dailyChallenge.js";

const router = Router();

// Accept the token from an Authorization: Bearer header, a query param, or body.
function tokenFrom(req) {
  const auth = req.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return (req.body?.token || req.query?.token || "").toString() || null;
}

// GET /api/daily — today's puzzle + your progress + streak.
router.get("/", async (req, res) => {
  try {
    const result = await getDailyStatus(tokenFrom(req));
    res.json(result);
  } catch (err) {
    console.error("[daily] status route failed:", err.message);
    res.status(500).json({ ok: false, error: "Could not load the daily challenge." });
  }
});

// POST /api/daily/guess — submit one guess { token, guess }.
router.post("/guess", async (req, res) => {
  try {
    const result = await submitDailyGuess(tokenFrom(req), req.body?.guess);
    res.json(result);
  } catch (err) {
    console.error("[daily] guess route failed:", err.message);
    res.status(500).json({ ok: false, error: "Could not submit your guess." });
  }
});

// GET /api/daily/leaderboard?date=YYYY-MM-DD&limit=n — defaults to today.
router.get("/leaderboard", async (req, res) => {
  try {
    const date  = (req.query.date || todayKey()).toString();
    const limit = Number(req.query.limit) || 50;
    res.json(await getDailyLeaderboard(date, limit));
  } catch (err) {
    console.error("[daily] leaderboard route failed:", err.message);
    res.status(500).json({ ok: false, error: "Could not load the daily leaderboard." });
  }
});

export default router;
