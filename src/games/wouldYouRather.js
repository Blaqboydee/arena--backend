/**
 * wouldYouRather.js
 * Both players simultaneously pick A or B.
 * Reveal choices, track agreement streak/stats.
 * Purely social — no "winning" per se, but we track agree vs disagree count.
 */

import { getPlayerList } from "../platform/roomManager.js";

const START_DELAY    = 1_500;
const REVEAL_DELAY   = 5_000;
const CHOOSE_TIME_MS = 20_000;

// ── Question bank ─────────────────────────────────────────────────────────────

const QUESTIONS = [
  { a: "Be able to fly", b: "Be able to read minds" },
  { a: "Live without music", b: "Live without movies" },
  { a: "Always be 10 minutes late", b: "Always be 20 minutes early" },
  { a: "Have unlimited money", b: "Have unlimited time" },
  { a: "Be famous", b: "Be powerful" },
  { a: "Fight 100 duck-sized horses", b: "Fight 1 horse-sized duck" },
  { a: "Never use social media again", b: "Never watch another movie" },
  { a: "Live in the past", b: "Live in the future" },
  { a: "Have super strength", b: "Have super speed" },
  { a: "Be invisible", b: "Be able to teleport" },
  { a: "Always speak the truth", b: "Always lie" },
  { a: "Be the funniest person alive", b: "Be the smartest person alive" },
  { a: "Live without the internet", b: "Live without AC / heating" },
  { a: "Explore space", b: "Explore the deep ocean" },
  { a: "Only eat pizza forever", b: "Only eat sushi forever" },
  { a: "Have a rewind button for life", b: "Have a pause button for life" },
  { a: "Be a famous athlete", b: "Be a famous musician" },
  { a: "Know how you die", b: "Know when you die" },
  { a: "Be stuck on an island alone", b: "Be stuck with someone you hate" },
  { a: "Never sleep", b: "Never eat" },
  { a: "Have one real superpower", b: "Have ten billion dollars" },
  { a: "Live in a treehouse", b: "Live in a submarine" },
  { a: "Always wear formal clothes", b: "Always wear pajamas" },
  { a: "Be 4 feet tall", b: "Be 8 feet tall" },
  { a: "Control fire", b: "Control water" },
  { a: "Only whisper", b: "Only shout" },
  { a: "Have a personal chef", b: "Have a personal chauffeur" },
  { a: "Never age physically", b: "Never age mentally" },
  { a: "Be Batman", b: "Be Iron Man" },
  { a: "Forget who you are", b: "Forget everyone you know" },
  { a: "Win the lottery", b: "Live twice as long" },
  { a: "Have no sense of humor", b: "Have no sense of direction" },
  { a: "Be a villain with power", b: "Be a hero with none" },
  { a: "Talk to animals", b: "Speak every language" },
  { a: "Time travel to the past", b: "Time travel to the future" },
  { a: "Live in a world with no rules", b: "Live in a world where you make the rules" },
  { a: "Only listen to one song forever", b: "Never listen to music again" },
  { a: "Be an amazing painter", b: "Be an amazing singer" },
  { a: "Live in the mountains", b: "Live by the beach" },
  { a: "Have free WiFi everywhere", b: "Have free food everywhere" },
  { a: "Be able to change the past", b: "Be able to see the future" },
  { a: "Always be cold", b: "Always be hot" },
  { a: "Give up your phone", b: "Give up your computer" },
  { a: "Be a genius everyone doubts", b: "Be average but everyone trusts you" },
  { a: "Have x-ray vision", b: "Have night vision" },
  { a: "Live forever in space", b: "Live 100 years on Earth" },
  { a: "Only eat sweet food", b: "Only eat savory food" },
  { a: "Be feared", b: "Be loved" },
  { a: "Know all the secrets of space", b: "Know all the secrets of the ocean" },
  { a: "Be the best player at every sport", b: "Be the best player at every video game" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSafe(room) {
  return room.state.wyr !== null && room.players.length === 2;
}

function clearTimer(room) {
  const timer = room.state.wyr?.round?.timer;
  if (timer) {
    clearTimeout(timer);
    room.state.wyr.round.timer = null;
  }
}

function pickQuestion(usedIndices) {
  const available = QUESTIONS.map((_, i) => i).filter((i) => !usedIndices.has(i));
  if (available.length === 0) {
    usedIndices.clear();
    return Math.floor(Math.random() * QUESTIONS.length);
  }
  return available[Math.floor(Math.random() * available.length)];
}

// ── State ─────────────────────────────────────────────────────────────────────

function initMatchState() {
  return {
    round:        0,
    agrees:       0,
    disagrees:    0,
    usedIndices:  new Set(),
  };
}

function initRoundState(questionIdx) {
  return {
    questionIdx,
    question:   QUESTIONS[questionIdx],
    choices:    {},   // { [playerId]: "a" | "b" }
    revealed:   false,
    timer:      null,
  };
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function startWouldYouRather(io, room) {
  if (!room.state.wyr) {
    room.state.wyr = {
      match: initMatchState(),
      round: null,
    };
  }

  setTimeout(() => {
    if (!isSafe(room)) return;
    startRound(io, room);
  }, START_DELAY);
}

function startRound(io, room) {
  if (!isSafe(room)) return;

  const { match } = room.state.wyr;
  match.round += 1;

  const qIdx = pickQuestion(match.usedIndices);
  match.usedIndices.add(qIdx);

  room.state.wyr.round = initRoundState(qIdx);

  const players = getPlayerList(room);

  io.to(room.id).emit("wyr_round_start", {
    roundNumber: match.round,
    question:    QUESTIONS[qIdx],
    agrees:      match.agrees,
    disagrees:   match.disagrees,
    players,
  });

  // Start choose timer
  room.state.wyr.round.timer = setTimeout(() => {
    if (!isSafe(room)) return;
    checkReveal(io, room, true);
  }, CHOOSE_TIME_MS);

  io.to(room.id).emit("wyr_timer", { timeLimit: CHOOSE_TIME_MS });

  console.log(`[wyr] round ${match.round} — "${QUESTIONS[qIdx].a}" vs "${QUESTIONS[qIdx].b}"`);
}

// ── Choice handler ────────────────────────────────────────────────────────────

export function handleWyrChoice(io, socket, room, choice) {
  if (!room.state.wyr) return;
  const { round } = room.state.wyr;
  if (round.revealed) return;

  if (choice !== "a" && choice !== "b") return;
  if (round.choices[socket.id]) return; // already chose

  round.choices[socket.id] = choice;

  // Notify that this player has chosen (without revealing what)
  const players = getPlayerList(room);
  io.to(room.id).emit("wyr_player_chose", {
    playerId: socket.id,
    players,
  });

  checkReveal(io, room, false);
}

function checkReveal(io, room, timeout) {
  const { round, match } = room.state.wyr;
  if (round.revealed) return;

  const bothChose = room.players.every((p) => round.choices[p.id]);

  if (!bothChose && !timeout) return;

  // Reveal
  round.revealed = true;
  clearTimer(room);

  const [p1, p2] = room.players;
  const c1 = round.choices[p1.id] ?? null;
  const c2 = round.choices[p2.id] ?? null;

  const agreed = c1 && c2 && c1 === c2;
  if (c1 && c2) {
    if (agreed) match.agrees++;
    else match.disagrees++;
  }

  const players = getPlayerList(room);

  io.to(room.id).emit("wyr_reveal", {
    choices:     round.choices,
    question:    round.question,
    agreed,
    agrees:      match.agrees,
    disagrees:   match.disagrees,
    roundNumber: match.round,
    players,
  });

  console.log(`[wyr] round ${match.round} — ${agreed ? "AGREE" : "DISAGREE"} (${match.agrees}/${match.disagrees})`);

  // Next round after delay
  const snap = match.round;
  setTimeout(() => {
    if (!isSafe(room)) return;
    if (room.state.wyr?.match.round !== snap) return;
    startRound(io, room);
  }, REVEAL_DELAY);
}

// ── End match ─────────────────────────────────────────────────────────────────

export function handleWyrEndMatch(io, socket, room) {
  if (!room.state.wyr) return;
  clearTimer(room);

  const { match } = room.state.wyr;

  io.to(room.id).emit("wyr_match_over", {
    totalRounds: match.round,
    agrees:      match.agrees,
    disagrees:   match.disagrees,
  });

  room.state.wyr = null;
  console.log(`[wyr] match over — ${match.round} rounds, ${match.agrees} agrees, ${match.disagrees} disagrees`);
}

// ── Forfeit ───────────────────────────────────────────────────────────────────

export function handleWyrForfeit(io, room, disconnectedPlayerId) {
  if (!room.state.wyr) return;
  clearTimer(room);

  const { match } = room.state.wyr;

  io.to(room.id).emit("wyr_match_over", {
    totalRounds: match.round,
    agrees:      match.agrees,
    disagrees:   match.disagrees,
    reason:      "forfeit",
  });

  room.state.wyr = null;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function cleanupWouldYouRather(room) {
  if (!room.state.wyr) return;
  clearTimer(room);
  room.state.wyr = null;
  console.log(`[wyr] cleaned up room ${room.id}`);
}
