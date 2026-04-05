/**
 * hangman.js
 * Asymmetric competitive Hangman engine.
 *
 * Each round one player is the "setter" (picks a word, reveals tiles on correct
 * guesses, hangs body parts on wrong guesses, gives a hint at the final limb)
 * and the other is the "guesser" (picks letters, tries to complete the word
 * before the caricature is fully hanged).
 *
 * Roles swap every round. Scores accumulate until a player ends the match.
 * Disconnect/refresh → forfeit match win awarded to opponent.
 *
 * Body parts hung in order:
 *   hat → head → body → leftArm → rightArm → leftLeg → [HINT] → rightLeg (hanged)
 *
 * Timers:
 *   Word picking  — 45 s
 *   Guessing      — 15 s per guess
 *   Hint giving   — 20 s
 */

import { getPlayerList } from "../platform/roomManager.js";

const PICK_TIMEOUT_MS  = 45_000;
const GUESS_TIMEOUT_MS = 15_000;
const HINT_TIMEOUT_MS  = 60_000;
const RESET_DELAY_MS   = 4_000;
const START_DELAY_MS   = 1_500;
const MAX_WRONG        = 7;

const BODY_PARTS = [
  "hat", "head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSafe(room) {
  return room.state.hm !== null && room.players.length === 2;
}

// ── State initialisers ────────────────────────────────────────────────────────

function initMatchState(players) {
  const [p1, p2] = players;
  return {
    scores:      { [p1.id]: 0, [p2.id]: 0 },
    firstSetter: p1.id,
    round:       0,
  };
}

function initRoundState(setterId, guesserId) {
  return {
    word:           null,     // set when setter submits
    maskedWord:     [],       // "_" per letter until revealed
    guessedLetters: new Set(),
    wrongCount:     0,
    phase:          "picking", // picking | guessing | hint | finished
    setterId,
    guesserId,
    hintGiven:      false,
    hint:           null,
    timer:          null,
  };
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function clearTimer(room) {
  const timer = room.state.hm?.round?.timer;
  if (timer) {
    clearTimeout(timer);
    room.state.hm.round.timer = null;
  }
}

function startGuessTimer(io, room) {
  if (!isSafe(room)) return;
  clearTimer(room);

  const { round } = room.state.hm;

  round.timer = setTimeout(() => {
    if (!isSafe(room)) return;
    if (round.phase !== "guessing") return;

    // Guesser timed out → counts as a wrong guess
    round.wrongCount += 1;
    console.log(`[hm] guess timeout — wrong ${round.wrongCount}/${MAX_WRONG}`);

    io.to(room.id).emit("hm_guess_result", {
      letter:    null,
      correct:   false,
      wrongCount: round.wrongCount,
      bodyParts: BODY_PARTS.slice(0, round.wrongCount),
      reason:    "timeout",
    });

    // Hint phase?
    if (round.wrongCount === MAX_WRONG - 1) {
      emitUpdate(io, room);
      enterHintPhase(io, room);
      return;
    }

    // Fully hanged?
    if (round.wrongCount >= MAX_WRONG) {
      endRound(io, room, round.setterId, "hanged");
      return;
    }

    emitUpdate(io, room);
    startGuessTimer(io, room);
  }, GUESS_TIMEOUT_MS);
}

// ── Emit update ───────────────────────────────────────────────────────────────

function emitUpdate(io, room) {
  const { round, match } = room.state.hm;

  room.players.forEach((player) => {
    player.emit("hm_update", {
      maskedWord:     round.maskedWord,
      wordLength:     round.word ? round.word.length : 0,
      guessedLetters: Array.from(round.guessedLetters),
      wrongCount:     round.wrongCount,
      maxWrong:       MAX_WRONG,
      bodyParts:      BODY_PARTS.slice(0, round.wrongCount),
      phase:          round.phase,
      setterId:       round.setterId,
      guesserId:      round.guesserId,
      scores:         match.scores,
      roundNumber:    match.round,
      hint:           round.hint,
      timeLimit:      round.phase === "hint"
                        ? HINT_TIMEOUT_MS
                        : round.phase === "picking"
                        ? PICK_TIMEOUT_MS
                        : GUESS_TIMEOUT_MS,
      // Only the setter sees the actual word
      word:           player.id === round.setterId ? round.word : null,
    });
  });
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function startHangman(io, room) {
  if (!room.state.hm) {
    room.state.hm = {
      match: initMatchState(room.players),
      round: null,
    };
  }

  setTimeout(() => {
    if (!isSafe(room)) return;
    startRound(io, room);
  }, START_DELAY_MS);
}

function startRound(io, room) {
  if (!isSafe(room)) return;

  const { match } = room.state.hm;
  match.round += 1;

  const isOddRound = match.round % 2 === 1;
  const setter  = isOddRound
    ? room.players.find((p) => p.id === match.firstSetter)
    : room.players.find((p) => p.id !== match.firstSetter);
  const guesser = room.players.find((p) => p.id !== setter.id);

  if (!setter || !guesser) return;

  room.state.hm.round = initRoundState(setter.id, guesser.id);

  const players = getPlayerList(room);

  // Tell both players the round has started and who is who
  room.players.forEach((player) => {
    player.emit("hm_pick_word", {
      setterId:    setter.id,
      guesserId:   guesser.id,
      roundNumber: match.round,
      scores:      match.scores,
      players,
      timeLimit:   PICK_TIMEOUT_MS,
    });
  });

  // Timer — setter must pick a word
  room.state.hm.round.timer = setTimeout(() => {
    if (!isSafe(room)) return;
    if (room.state.hm.round.phase !== "picking") return;
    console.log(`[hm] pick timeout — setter ${setter.id} didn't pick a word`);
    endRound(io, room, guesser.id, "pick_timeout");
  }, PICK_TIMEOUT_MS);

  console.log(`[hm] round ${match.round} — setter: ${setter.id}, guesser: ${guesser.id}`);
}

// ── Word submission ───────────────────────────────────────────────────────────

export function handleHmSubmitWord(io, socket, room, word) {
  if (!room.state.hm) return;
  const { round } = room.state.hm;

  if (round.phase !== "picking")    return;
  if (socket.id !== round.setterId) return;

  const cleaned = (typeof word === "string" ? word : "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  if (cleaned.length < 2 || cleaned.length > 14) {
    socket.emit("hm_pick_error", { message: "Word must be 2–14 letters." });
    return;
  }

  clearTimer(room);

  round.word       = cleaned;
  round.maskedWord = Array(cleaned.length).fill("_");
  round.phase      = "guessing";

  console.log(`[hm] word set: ${cleaned} by ${socket.id}`);

  emitUpdate(io, room);
  startGuessTimer(io, room);
}

// ── Guess handler ─────────────────────────────────────────────────────────────

export function handleHmGuess(io, socket, room, letter) {
  if (!room.state.hm) return;
  const { round } = room.state.hm;

  if (round.phase !== "guessing")    return;
  if (socket.id !== round.guesserId) return;

  const ch = (typeof letter === "string" ? letter : "").toUpperCase();
  if (!/^[A-Z]$/.test(ch))          return;
  if (round.guessedLetters.has(ch))  return;

  clearTimer(room);
  round.guessedLetters.add(ch);

  const isCorrect = round.word.includes(ch);

  if (isCorrect) {
    // Reveal all instances of the letter
    for (let i = 0; i < round.word.length; i++) {
      if (round.word[i] === ch) round.maskedWord[i] = ch;
    }

    io.to(room.id).emit("hm_guess_result", {
      letter:     ch,
      correct:    true,
      wrongCount: round.wrongCount,
      bodyParts:  BODY_PARTS.slice(0, round.wrongCount),
    });

    // Word complete → guesser wins
    if (round.maskedWord.every((c) => c !== "_")) {
      endRound(io, room, round.guesserId, "guessed");
      return;
    }
  } else {
    round.wrongCount += 1;

    io.to(room.id).emit("hm_guess_result", {
      letter:     ch,
      correct:    false,
      wrongCount: round.wrongCount,
      bodyParts:  BODY_PARTS.slice(0, round.wrongCount),
    });

    // One limb left → setter must give a hint
    if (round.wrongCount === MAX_WRONG - 1) {
      emitUpdate(io, room);
      enterHintPhase(io, room);
      return;
    }

    // Fully hanged → setter wins
    if (round.wrongCount >= MAX_WRONG) {
      endRound(io, room, round.setterId, "hanged");
      return;
    }
  }

  emitUpdate(io, room);
  startGuessTimer(io, room);
}

// ── Hint phase ────────────────────────────────────────────────────────────────
// Entered when only one body part (right leg) remains.
// Setter has HINT_TIMEOUT_MS to type a hint. If they don't, guesser wins.

function enterHintPhase(io, room) {
  if (!room.state.hm) return;
  const { round } = room.state.hm;

  round.phase = "hint";
  clearTimer(room);

  console.log(`[hm] hint phase — setter ${round.setterId} must give a hint`);

  emitUpdate(io, room);

  round.timer = setTimeout(() => {
    if (!isSafe(room)) return;
    if (round.phase !== "hint") return;
    // Setter failed to give a hint → guesser wins
    console.log(`[hm] hint timeout — setter failed to hint, guesser wins`);
    endRound(io, room, round.guesserId, "no_hint");
  }, HINT_TIMEOUT_MS);
}

// ── Hint submission ───────────────────────────────────────────────────────────

export function handleHmGiveHint(io, socket, room, hint) {
  if (!room.state.hm) return;
  const { round } = room.state.hm;

  if (round.phase !== "hint")       return;
  if (socket.id !== round.setterId) return;

  const cleaned = (typeof hint === "string" ? hint : "").trim().slice(0, 100);
  if (!cleaned) {
    socket.emit("hm_hint_error", { message: "Hint cannot be empty." });
    return;
  }

  clearTimer(room);

  round.hint      = cleaned;
  round.hintGiven = true;
  round.phase     = "guessing"; // resume — guesser gets one last chance

  console.log(`[hm] hint given: "${cleaned}"`);

  emitUpdate(io, room);
  startGuessTimer(io, room);
}

// ── End round ─────────────────────────────────────────────────────────────────

function endRound(io, room, winnerId, reason) {
  if (!room.state.hm) return;

  const { round, match } = room.state.hm;
  round.phase = "finished";
  clearTimer(room);

  if (winnerId) {
    match.scores[winnerId] = (match.scores[winnerId] ?? 0) + 1;
  }

  const players    = getPlayerList(room);
  const winnerName = winnerId
    ? players.find((p) => p.id === winnerId)?.name ?? "Unknown"
    : null;

  io.to(room.id).emit("hm_round_result", {
    winnerId,
    winnerName,
    reason,
    word:        round.word,
    wrongCount:  round.wrongCount,
    scores:      match.scores,
    roundNumber: match.round,
    maxWrong:    MAX_WRONG,
    setterId:    round.setterId,
    guesserId:   round.guesserId,
  });

  console.log(
    `[hm] round ${match.round} — winner: ${winnerName ?? "none"} ${reason ? `(${reason})` : ""}`
  );

  const roundSnapshot = match.round;
  setTimeout(() => {
    if (!isSafe(room)) return;
    if (match.round !== roundSnapshot) return;
    startRound(io, room);
  }, RESET_DELAY_MS);
}

// ── End match (voluntary) ─────────────────────────────────────────────────────

export function handleHmEndMatch(io, socket, room) {
  if (!room.state.hm) return;

  clearTimer(room);

  if (room.state.hm.round) {
    room.state.hm.round.phase = "finished";
  }

  const { match } = room.state.hm;
  const players   = getPlayerList(room);
  const [p1, p2]  = room.players;

  let overallWinnerId = null;
  if (match.scores[p1.id] > match.scores[p2.id])      overallWinnerId = p1.id;
  else if (match.scores[p2.id] > match.scores[p1.id]) overallWinnerId = p2.id;

  const winnerName = overallWinnerId
    ? players.find((p) => p.id === overallWinnerId)?.name ?? "Unknown"
    : null;

  io.to(room.id).emit("hm_match_over", {
    winnerId:    overallWinnerId,
    winnerName,
    scores:      match.scores,
    totalRounds: match.round,
  });

  room.state.hm = null;
  console.log(`[hm] match over — ${winnerName ?? "draw"} | ${match.round} rounds`);
}

// ── Forfeit match (disconnect / refresh) ──────────────────────────────────────

export function handleHmForfeit(io, room, disconnectedPlayerId) {
  if (!room.state.hm) return;

  clearTimer(room);

  if (room.state.hm.round) {
    room.state.hm.round.phase = "finished";
  }

  const { match } = room.state.hm;
  const players   = getPlayerList(room);

  const winner = players.find((p) => p.id !== disconnectedPlayerId) ?? null;
  const loser  = players.find((p) => p.id === disconnectedPlayerId) ?? null;

  const winnerId   = winner?.id   ?? null;
  const winnerName = winner?.name ?? null;

  console.log(
    `[hm] forfeit — ${loser?.id ?? disconnectedPlayerId} disconnected, ` +
    `${winnerName ?? "opponent"} wins room ${room.id}`
  );

  io.to(room.id).emit("hm_match_over", {
    winnerId,
    winnerName,
    scores:      match.scores,
    totalRounds: match.round,
    reason:      "forfeit",
  });

  room.state.hm = null;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function cleanupHangman(room) {
  if (!room.state.hm) return;
  clearTimer(room);
  if (room.state.hm.round) room.state.hm.round.phase = "finished";
  room.state.hm = null;
  console.log(`[hm] cleaned up room ${room.id}`);
}
