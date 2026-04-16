/**
 * triviaRoyale.js
 * Kahoot-style multiplayer trivia. 3–8 players.
 *
 * Host (room creator) picks when to start. Everyone answers timed MCQs.
 * Faster correct answers = more points.
 * Leaderboard shown after each question. 10 questions per match.
 *
 * Scoring:
 *   Correct + fast (< 3s)  → 1000 pts
 *   Correct + medium       → 750 pts
 *   Correct + slow         → 500 pts
 *   Wrong / timeout        → 0 pts
 */

import { getPlayerList } from "../platform/roomManager.js";

const QUESTION_TIME_MS = 15_000;
const REVEAL_DELAY_MS  = 5_000;
const START_DELAY_MS   = 2_000;
const TOTAL_QUESTIONS  = 10;

// ── Question bank ─────────────────────────────────────────────────────────────
// cat: "science" | "geography" | "culture"

const QUESTIONS = [
  { q: "What planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: 1, cat: "science" },
  { q: "What is the chemical symbol for gold?", options: ["Ag", "Fe", "Au", "Cu"], answer: 2, cat: "science" },
  { q: "How many bones are in the adult human body?", options: ["186", "206", "226", "246"], answer: 1, cat: "science" },
  { q: "Which country has the most natural lakes?", options: ["USA", "Russia", "Canada", "Brazil"], answer: 2, cat: "geography" },
  { q: "What year did the Berlin Wall fall?", options: ["1987", "1989", "1991", "1993"], answer: 1, cat: "culture" },
  { q: "What is the smallest prime number?", options: ["0", "1", "2", "3"], answer: 2, cat: "science" },
  { q: "Which element has the atomic number 1?", options: ["Helium", "Hydrogen", "Lithium", "Carbon"], answer: 1, cat: "science" },
  { q: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Pacific", "Arctic"], answer: 2, cat: "geography" },
  { q: "Who painted the Mona Lisa?", options: ["Michelangelo", "Da Vinci", "Raphael", "Donatello"], answer: 1, cat: "culture" },
  { q: "What is the speed of light in km/s (approx)?", options: ["150,000", "300,000", "450,000", "600,000"], answer: 1, cat: "science" },
  { q: "What gas do plants absorb from the atmosphere?", options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"], answer: 1, cat: "science" },
  { q: "In what year did World War I begin?", options: ["1912", "1914", "1916", "1918"], answer: 1, cat: "culture" },
  { q: "What is the hardest natural substance?", options: ["Gold", "Iron", "Diamond", "Platinum"], answer: 2, cat: "science" },
  { q: "How many continents are there?", options: ["5", "6", "7", "8"], answer: 2, cat: "geography" },
  { q: "Which planet has the most moons?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], answer: 1, cat: "science" },
  { q: "What is the boiling point of water in Celsius?", options: ["90°C", "100°C", "110°C", "120°C"], answer: 1, cat: "science" },
  { q: "Who wrote 'Romeo and Juliet'?", options: ["Dickens", "Shakespeare", "Austen", "Hemingway"], answer: 1, cat: "culture" },
  { q: "What is the currency of Japan?", options: ["Yuan", "Won", "Yen", "Peso"], answer: 2, cat: "geography" },
  { q: "Which organ pumps blood through the body?", options: ["Brain", "Heart", "Lungs", "Liver"], answer: 1, cat: "science" },
  { q: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], answer: 1, cat: "science" },
  { q: "What is the tallest mountain in the world?", options: ["K2", "Everest", "Kangchenjunga", "Lhotse"], answer: 1, cat: "geography" },
  { q: "What does DNA stand for?", options: ["Deoxyribonucleic Acid", "Dinitrogen Acid", "Dynamic Neural Array", "Dense Nucleic Acid"], answer: 0, cat: "science" },
  { q: "Which country invented pizza?", options: ["Greece", "Italy", "France", "Spain"], answer: 1, cat: "culture" },
  { q: "How many teeth does an adult human have?", options: ["28", "30", "32", "34"], answer: 2, cat: "science" },
  { q: "What color is a ruby?", options: ["Blue", "Green", "Red", "Yellow"], answer: 2, cat: "culture" },
  { q: "Which is the longest river in the world?", options: ["Amazon", "Nile", "Mississippi", "Yangtze"], answer: 1, cat: "geography" },
  { q: "What does HTTP stand for?", options: ["HyperText Transfer Protocol", "High Tech Transfer Program", "Hyper Transfer Text Protocol", "Home Tool Transfer Protocol"], answer: 0, cat: "culture" },
  { q: "What is the main language spoken in Brazil?", options: ["Spanish", "Portuguese", "French", "English"], answer: 1, cat: "geography" },
  { q: "How many strings does a standard guitar have?", options: ["4", "5", "6", "7"], answer: 2, cat: "culture" },
  { q: "What creature is known as 'man's best friend'?", options: ["Cat", "Dog", "Horse", "Parrot"], answer: 1, cat: "culture" },
  { q: "What is the square root of 144?", options: ["10", "11", "12", "13"], answer: 2, cat: "science" },
  { q: "Which gas makes up most of Earth's atmosphere?", options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Argon"], answer: 2, cat: "science" },
  { q: "What is the capital of Australia?", options: ["Sydney", "Melbourne", "Canberra", "Perth"], answer: 2, cat: "geography" },
  { q: "How many minutes are in a day?", options: ["1240", "1340", "1440", "1540"], answer: 2, cat: "science" },
  { q: "What vitamin does the sun provide?", options: ["A", "B", "C", "D"], answer: 3, cat: "science" },
  { q: "Which animal can fly backwards?", options: ["Eagle", "Hummingbird", "Bat", "Parrot"], answer: 1, cat: "science" },
  { q: "What is the largest organ in the human body?", options: ["Liver", "Brain", "Skin", "Heart"], answer: 2, cat: "science" },
  { q: "Which country has the largest population?", options: ["USA", "India", "China", "Indonesia"], answer: 1, cat: "geography" },
  { q: "How many zeros are in a million?", options: ["5", "6", "7", "8"], answer: 1, cat: "science" },
  { q: "What year was the first iPhone released?", options: ["2005", "2006", "2007", "2008"], answer: 2, cat: "culture" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSafe(room) {
  return room.state.triv !== null && room.players.length >= 2;
}

function clearTimer(room) {
  const timer = room.state.triv?.currentTimer;
  if (timer) {
    clearTimeout(timer);
    room.state.triv.currentTimer = null;
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickQuestions(count) {
  return shuffle(QUESTIONS).slice(0, count);
}

/**
 * Pick up to `count` questions from a category.
 * If the category has fewer than `count`, supplement with random questions
 * from the rest of the bank so the total reaches `count`.
 */
function pickFromPack(pack, count) {
  const inPack  = shuffle(QUESTIONS.filter((q) => q.cat === pack));
  const outside = shuffle(QUESTIONS.filter((q) => q.cat !== pack));
  return [...inPack, ...outside].slice(0, count);
}

/**
 * Validate and sanitise custom questions coming from the client.
 * Returns a normalised array, or null if validation fails.
 */
function validateCustomQuestions(raw) {
  if (!Array.isArray(raw)) return null;
  if (raw.length < 3 || raw.length > 20) return null;

  const validated = [];
  for (const item of raw) {
    if (!item || typeof item.q !== "string") return null;
    const q = item.q.trim().slice(0, 300);
    if (!q) return null;

    if (!Array.isArray(item.options) || item.options.length !== 4) return null;
    const options = item.options.map((o) =>
      typeof o === "string" ? o.trim().slice(0, 200) : ""
    );
    if (options.some((o) => !o)) return null;

    if (typeof item.answer !== "number" || ![0, 1, 2, 3].includes(item.answer)) return null;

    validated.push({ q, options, answer: item.answer });
  }
  return validated;
}

function calcScore(answerTime) {
  if (answerTime < 3000) return 1000;
  if (answerTime < 8000) return 750;
  return 500;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function startTriviaRoyale(io, room, questionConfig) {
  let questions;

  if (questionConfig?.mode === "custom" && Array.isArray(questionConfig.questions)) {
    const validated = validateCustomQuestions(questionConfig.questions);
    // If validation fails fall back to random so bad input can't crash the match
    questions = validated ?? pickQuestions(TOTAL_QUESTIONS);
  } else if (questionConfig?.mode === "pack" && questionConfig.pack) {
    questions = pickFromPack(questionConfig.pack, TOTAL_QUESTIONS);
  } else {
    questions = pickQuestions(TOTAL_QUESTIONS);
  }

  room.state.triv = {
    questions,
    currentQ:     0,
    scores:       {},
    answers:      {},     // { [playerId]: { choice, time } } for current question
    currentTimer: null,
    phase:        "starting",   // starting | question | reveal | finished
  };

  // Initialize scores
  room.players.forEach((p) => {
    room.state.triv.scores[p.id] = 0;
  });

  const players = getPlayerList(room);

  io.to(room.id).emit("triv_match_start", {
    totalQuestions: questions.length,
    playerCount:   room.players.length,
    players,
  });

  setTimeout(() => {
    if (!isSafe(room)) return;
    nextQuestion(io, room);
  }, START_DELAY_MS);

  console.log(`[triv] match started — ${room.players.length} players, ${questions.length} questions`);
}

function nextQuestion(io, room) {
  if (!isSafe(room)) return;
  const { triv } = room.state;
  if (!triv) return;

  if (triv.currentQ >= triv.questions.length) {
    endMatch(io, room);
    return;
  }

  const q = triv.questions[triv.currentQ];
  triv.answers = {};
  triv.phase = "question";
  triv.questionStartedAt = Date.now();

  const players = getPlayerList(room);

  io.to(room.id).emit("triv_question", {
    questionNumber: triv.currentQ + 1,
    totalQuestions: triv.questions.length,
    question:       q.q,
    options:        q.options,
    timeLimit:      QUESTION_TIME_MS,
    scores:         triv.scores,
    players,
  });

  // Timeout — reveal answer
  triv.currentTimer = setTimeout(() => {
    if (!room.state.triv || triv.phase !== "question") return;
    revealAnswer(io, room);
  }, QUESTION_TIME_MS);

  console.log(`[triv] Q${triv.currentQ + 1}: "${q.q}"`);
}

// ── Answer handler ────────────────────────────────────────────────────────────

export function handleTrivAnswer(io, socket, room, choice) {
  if (!room.state.triv) return;
  const { triv } = room.state;
  if (triv.phase !== "question") return;

  // Already answered
  if (triv.answers[socket.id]) return;

  // Validate choice
  if (typeof choice !== "number" || choice < 0 || choice >= 4) return;

  triv.answers[socket.id] = {
    choice,
    time: Date.now(),
  };

  // Notify everyone that this player answered (without revealing what)
  const players = getPlayerList(room);
  const answeredCount = Object.keys(triv.answers).length;

  io.to(room.id).emit("triv_player_answered", {
    playerId:      socket.id,
    answeredCount,
    totalPlayers:  room.players.length,
    players,
  });

  // If everyone answered, reveal early
  if (answeredCount >= room.players.length) {
    clearTimer(room);
    revealAnswer(io, room);
  }
}

function revealAnswer(io, room) {
  if (!room.state.triv) return;
  const { triv } = room.state;
  if (triv.phase !== "question") return;

  triv.phase = "reveal";
  clearTimer(room);

  const q = triv.questions[triv.currentQ];
  const correctAnswer = q.answer;

  // Calculate scores for this question
  const playerResults = {};

  room.players.forEach((p) => {
    const answer = triv.answers[p.id];
    let points = 0;
    let correct = false;

    if (answer && answer.choice === correctAnswer) {
      correct = true;
      const elapsed = answer.time - triv.questionStartedAt;
      points = calcScore(Math.max(0, elapsed));
    }

    if (points > 0) {
      triv.scores[p.id] = (triv.scores[p.id] ?? 0) + points;
    }

    playerResults[p.id] = {
      choice:  answer?.choice ?? null,
      correct,
      points,
    };
  });

  const players = getPlayerList(room);

  // Sort leaderboard by score descending
  const leaderboard = players
    .map((p) => ({ ...p, score: triv.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  io.to(room.id).emit("triv_reveal", {
    questionNumber:  triv.currentQ + 1,
    correctAnswer,
    question:        q.q,
    options:         q.options,
    playerResults,
    scores:          triv.scores,
    leaderboard,
    players,
  });

  triv.currentQ += 1;

  // Next question or end
  triv.currentTimer = setTimeout(() => {
    if (!room.state.triv) return;
    nextQuestion(io, room);
  }, REVEAL_DELAY_MS);
}

// ── End match ─────────────────────────────────────────────────────────────────

function endMatch(io, room) {
  if (!room.state.triv) return;
  const { triv } = room.state;
  triv.phase = "finished";
  clearTimer(room);

  const players = getPlayerList(room);
  const leaderboard = players
    .map((p) => ({ ...p, score: triv.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const winnerId   = leaderboard[0]?.id ?? null;
  const winnerName = leaderboard[0]?.name ?? null;

  io.to(room.id).emit("triv_match_over", {
    winnerId,
    winnerName,
    scores:         triv.scores,
    leaderboard,
    totalQuestions: triv.questions.length,
  });

  room.state.triv = null;
  console.log(`[triv] match over — winner: ${winnerName}`);
}

export function handleTrivEndMatch(io, socket, room) {
  if (!room.state.triv) return;
  endMatch(io, room);
}

// ── Forfeit / disconnect ──────────────────────────────────────────────────────

export function handleTrivForfeit(io, room, disconnectedPlayerId) {
  if (!room.state.triv) return;

  // In trivia, disconnecting just removes you from scoring.
  // If only 1 player left, end the match.
  if (room.players.length < 2) {
    endMatch(io, room);
    return;
  }

  // Otherwise, notify remaining players
  const players = getPlayerList(room);
  io.to(room.id).emit("triv_player_left", {
    playerId: disconnectedPlayerId,
    players,
    remainingCount: room.players.length,
  });
}

export function cleanupTriviaRoyale(room) {
  if (!room.state.triv) return;
  clearTimer(room);
  room.state.triv = null;
  console.log(`[triv] cleaned up room ${room.id}`);
}
