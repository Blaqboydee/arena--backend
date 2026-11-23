/**
 * triviaRoutes.js
 * Read-only metadata for the built-in Trivia packs. Mounted at /api/trivia.
 * The lobby uses this to render the pack picker — answers never leave the server.
 */

import { Router } from "express";
import { PACK_META } from "../games/triviaQuestions.js";

const router = Router();

// GET /api/trivia/packs — [{ id, label, icon, count }]
router.get("/packs", (_req, res) => {
  res.json({ packs: PACK_META });
});

export default router;
