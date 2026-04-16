/**
 * wordleDuel.js
 * Simultaneous Wordle — both players guess the same 5-letter word.
 * Server picks the answer, validates guesses, returns color feedback.
 * Round ends when both players finish (solve or use all 6 guesses).
 * Match is best-of rounds, scored by who solved it (and in fewer attempts).
 */

import { getPlayerList } from "../platform/roomManager.js";

const MAX_GUESSES       = 6;
const WORD_LENGTH       = 5;
const START_DELAY       = 1_500;
const ROUND_END_DELAY   = 5_000;

// ── Word lists ────────────────────────────────────────────────────────────────
// Answer words: curated common 5-letter English words (~300 words).
// Valid guesses: a broader set including answer words.

const ANSWER_WORDS = [
  "about","above","abuse","actor","adapt","admit","adopt","adult","after","again",
  "agent","agree","ahead","alarm","album","alien","align","alive","allow","alone",
  "along","alter","amaze","among","angel","anger","angle","angry","anime","ankle",
  "annoy","apart","apple","apply","arena","argue","arise","armor","army","array",
  "aside","asset","avoid","awake","award","aware","badly","basic","basis","batch",
  "beach","begun","being","belly","bench","berry","birth","black","blade","blame",
  "blank","blast","blaze","bleed","blend","bless","blind","block","blood","bloom",
  "blown","blues","blunt","board","bonus","boost","booth","bound","brain","brand",
  "brave","bread","break","breed","brick","bride","brief","bring","broad","broke",
  "brook","brown","brush","buddy","build","built","bunch","burst","buyer","cabin",
  "cable","cancel","candy","cargo","carry","catch","cause","chain","chair","chalk",
  "champ","chaos","charm","chart","chase","cheap","check","cheer","chess","chest",
  "chief","child","chill","china","chips","choir","chord","chose","chunk","civil",
  "claim","clash","class","clean","clear","clerk","click","cliff","climb","cling",
  "clock","clone","close","cloth","cloud","coach","coast","color","comic","coral",
  "couch","could","count","court","cover","crack","craft","crane","crash","crazy",
  "cream","crime","crisp","cross","crowd","crown","cruel","crush","cubic","curve",
  "cycle","daily","dance","death","debut","decay","delay","delta","demon","dense",
  "depot","depth","derby","desk","devil","dirty","disco","ditch","doing","donor",
  "doubt","dough","draft","drain","drama","drank","drape","drawn","dream","dress",
  "dried","drift","drill","drink","drive","drone","drops","drove","drugs","drunk",
  "dryer","dying","eager","eagle","early","earth","eight","elect","elite","embed",
  "ember","empty","ended","enemy","enjoy","enter","entry","equal","equip","erase",
  "error","essay","ethic","event","every","exact","exam","exist","extra","fable",
  "facet","facto","fairy","faith","false","fancy","fatal","fault","feast","fence",
  "fetch","fever","fiber","field","fifty","fight","filed","final","first","fixed",
  "flame","flash","fleet","flesh","float","flood","floor","flour","fluid","flush",
  "flute","focus","force","forge","forth","forum","found","frame","frank","fraud",
  "fresh","front","froze","fruit","funds","funny","genre","ghost","giant","given",
  "glare","glass","globe","gloom","glory","glove","going","grace","grade","grain",
  "grand","grant","graph","grasp","grass","grave","great","green","greet","grief",
  "grill","grind","groan","gross","group","grove","grown","guard","guess","guest",
  "guide","guilt","guise","guitar","happy","harsh","haven","heard","heart","heavy",
  "hedge","hello","hence","herbs","hobby","Holly","honor","horse","hotel","house",
  "human","humor","hurry","hyper","ideal","image","imply","inbox","index","indie",
  "inner","input","intro","irony","ivory","jeans","jewel","joint","joker","jolly",
  "judge","juice","juicy","jumbo","jumps","karma","kayak","knack","kneel","knife",
  "knock","known","label","labor","lance","large","laser","later","laugh","layer",
  "leads","learn","lease","least","leave","legal","lemon","level","light","limit",
  "linen","liver","local","lodge","logic","login","looks","loose","lorry","lover",
  "lower","loyal","lucky","lunch","lying","magic","major","maker","manga","manor",
  "maple","march","marry","mason","match","maybe","mayor","meant","medal","media",
  "melon","mercy","merge","merit","metal","meter","might","minor","minus","mixed",
  "model","money","month","moral","motor","mount","mouse","mouth","moved","movie",
  "music","nasty","naval","nerve","never","newer","newly","night","noble","noise",
  "north","noted","novel","nurse","nylon","occur","ocean","olive","onset","opera",
  "orbit","order","organ","other","ought","outer","owned","owner","oxide","ozone",
  "paint","panel","panic","paper","paste","patch","pause","peace","peach","pearl",
  "penny","perch","phase","phone","photo","piano","piece","pilot","pinch","pixel",
  "pizza","place","plain","plane","plant","plate","plaza","plead","plumb","plume",
  "plunge","plush","point","polar","polls","pouch","pound","power","press","price",
  "pride","prime","print","prior","prize","probe","prone","proof","prose","proud",
  "prove","proxy","psalm","pulse","punch","pupil","purse","queen","query","quest",
  "queue","quick","quiet","quota","quote","radar","radio","raise","rally","ranch",
  "range","rapid","ratio","reach","react","realm","rebel","refer","reign","relax",
  "relay","renew","reply","resin","rider","ridge","rifle","rigid","risen","risky",
  "rival","river","robin","robot","rocky","rouge","rough","round","route","royal",
  "rugby","ruins","ruler","rural","sadly","saint","salad","sauce","scale","scare",
  "scene","scent","scope","score","scout","scrap","seize","sense","serve","setup",
  "seven","shade","shake","shall","shame","shape","share","shark","sharp","sheep",
  "sheer","sheet","shelf","shell","shift","shine","shirt","shock","shoot","shore",
  "shout","shown","sight","silly","since","sixth","sixty","sized","skill","skull",
  "slash","slate","slave","sleep","slide","slope","small","smart","smell","smile",
  "smoke","snake","solar","solid","solve","sorry","south","space","spare","spark",
  "speak","speed","spell","spend","spent","spice","spine","spite","split","spoke",
  "spoon","sport","spray","squad","stack","staff","stage","stain","stake","stale",
  "stall","stamp","stand","stare","stark","start","state","stave","stays","steak",
  "steal","steam","steel","steep","steer","stern","stick","stiff","still","stock",
  "stone","stood","store","storm","story","stove","strap","straw","stray","strip",
  "stuck","study","stuff","stump","style","sugar","suite","super","surge","swamp",
  "swear","sweep","sweet","swept","swift","swing","sword","swore","sworn","swung",
  "table","taste","teach","teeth","tempo","tends","tenth","terms","theme","there",
  "thick","thing","think","third","thorn","those","three","threw","throw","thumb",
  "tiger","tight","timer","tired","title","today","token","total","touch","tough",
  "towel","tower","toxic","trace","track","trade","trail","train","trait","trash",
  "treat","trend","trial","tribe","trick","tried","troop","truck","truly","trump",
  "trunk","trust","truth","tumor","tuner","twice","twist","ultra","uncle","under",
  "unify","union","unite","unity","until","upper","upset","urban","usage","usual",
  "utter","valid","value","valve","vapor","vault","venue","verse","vigor","vinyl",
  "viral","virus","visit","vital","vivid","vocal","vodka","voice","voter","waist",
  "waste","watch","water","weary","weave","wedge","weigh","weird","whale","wheat",
  "wheel","where","which","while","white","whole","whose","wider","widow","width",
  "witch","woman","women","world","worry","worse","worst","worth","would","wound",
  "wreck","write","wrong","wrote","yacht","young","youth","zebra","zones",
];

// Lowercase + dedupe answer words
const ANSWERS = [...new Set(ANSWER_WORDS.map((w) => w.toLowerCase().trim()).filter((w) => w.length === WORD_LENGTH))];

// Accept any 5-letter alphabetic string as a guess (casual multiplayer — no exploit)
const ALPHA_RE = /^[a-z]{5}$/;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSafe(room) {
  return room.state.wdl !== null && room.players.length === 2;
}

function pickWord(usedWords) {
  const available = ANSWERS.filter((w) => !usedWords.has(w));
  if (available.length === 0) {
    // All words used — reset
    usedWords.clear();
    return ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Grade a guess against the answer.
 * Returns array of 5 "correct" | "present" | "absent" values.
 */
function gradeGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill("absent");
  const answerChars = answer.split("");
  const guessChars  = guess.split("");
  const used = Array(WORD_LENGTH).fill(false);

  // Pass 1: correct (green)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessChars[i] === answerChars[i]) {
      result[i] = "correct";
      used[i] = true;
    }
  }

  // Pass 2: present (yellow)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    for (let j = 0; j < WORD_LENGTH; j++) {
      if (!used[j] && guessChars[i] === answerChars[j]) {
        result[i] = "present";
        used[j] = true;
        break;
      }
    }
  }

  return result;
}

// ── State ─────────────────────────────────────────────────────────────────────

function initMatchState(players) {
  const [p1, p2] = players;
  return {
    scores:    { [p1.id]: 0, [p2.id]: 0 },
    round:     0,
    usedWords: new Set(),
  };
}

function initRoundState(answer) {
  return {
    answer,
    players: {},    // { [playerId]: { guesses: [{word, grade}], solved: bool, finished: bool } }
    finished: false,
  };
}

function initPlayerRound() {
  return {
    guesses:  [],      // [{ word: string, grade: string[] }]
    solved:   false,
    finished: false,
  };
}

// ── Emit ──────────────────────────────────────────────────────────────────────

function emitPlayerState(io, room, playerId) {
  const { round, match } = room.state.wdl;
  const pr = round.players[playerId];
  if (!pr) return;

  const socket = room.players.find((p) => p.id === playerId);
  if (!socket) return;

  // Find opponent progress (guesses count only, not words)
  const oppId = room.players.find((p) => p.id !== playerId)?.id;
  const oppPr = oppId ? round.players[oppId] : null;

  socket.emit("wdl_update", {
    roundNumber:    match.round,
    guesses:        pr.guesses,
    solved:         pr.solved,
    finished:       pr.finished,
    maxGuesses:     MAX_GUESSES,
    wordLength:     WORD_LENGTH,
    scores:         match.scores,
    oppGuessCount:  oppPr?.guesses.length ?? 0,
    oppFinished:    oppPr?.finished ?? false,
    oppSolved:      pr.finished && oppPr?.finished ? (oppPr?.solved ?? false) : false,
  });
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function startWordleDuel(io, room) {
  if (!room.state.wdl) {
    room.state.wdl = {
      match: initMatchState(room.players),
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

  const { match } = room.state.wdl;
  match.round += 1;

  const answer = pickWord(match.usedWords);
  match.usedWords.add(answer);

  room.state.wdl.round = initRoundState(answer);

  // Init per-player state
  for (const p of room.players) {
    room.state.wdl.round.players[p.id] = initPlayerRound();
  }

  const players = getPlayerList(room);

  io.to(room.id).emit("wdl_round_start", {
    roundNumber: match.round,
    wordLength:  WORD_LENGTH,
    maxGuesses:  MAX_GUESSES,
    scores:      match.scores,
    players,
  });

  console.log(`[wdl] round ${match.round} — answer: ${answer}`);
}

// ── Guess handler ─────────────────────────────────────────────────────────────

export function handleWdlGuess(io, socket, room, word) {
  if (!room.state.wdl) return;
  const { round, match } = room.state.wdl;
  if (round.finished) return;

  const pr = round.players[socket.id];
  if (!pr || pr.finished) return;

  // Validate
  const clean = (word ?? "").toLowerCase().trim();
  if (clean.length !== WORD_LENGTH) return;
  if (!ALPHA_RE.test(clean)) {
    socket.emit("wdl_invalid_word", { word: clean });
    return;
  }

  // Grade
  const grade = gradeGuess(clean, round.answer);
  pr.guesses.push({ word: clean, grade });

  // Check if solved
  if (grade.every((g) => g === "correct")) {
    pr.solved   = true;
    pr.finished = true;
  } else if (pr.guesses.length >= MAX_GUESSES) {
    pr.finished = true;
  }

  // Send update to both
  for (const p of room.players) {
    emitPlayerState(io, room, p.id);
  }

  // Check if both finished
  const allFinished = room.players.every((p) => round.players[p.id]?.finished);
  if (allFinished) {
    round.finished = true;
    endRound(io, room);
  }
}

// ── End round ─────────────────────────────────────────────────────────────────

function endRound(io, room) {
  if (!room.state.wdl) return;
  const { round, match } = room.state.wdl;

  const [p1, p2] = room.players;
  const pr1 = round.players[p1.id];
  const pr2 = round.players[p2.id];

  // Scoring: solve = 1pt, solve in fewer guesses = bonus 1pt
  let winnerId   = null;
  let winnerName = null;

  if (pr1.solved && !pr2.solved) {
    winnerId = p1.id;
    match.scores[p1.id] += 1;
  } else if (pr2.solved && !pr1.solved) {
    winnerId = p2.id;
    match.scores[p2.id] += 1;
  } else if (pr1.solved && pr2.solved) {
    // Both solved — fewer guesses wins
    if (pr1.guesses.length < pr2.guesses.length) {
      winnerId = p1.id;
      match.scores[p1.id] += 1;
    } else if (pr2.guesses.length < pr1.guesses.length) {
      winnerId = p2.id;
      match.scores[p2.id] += 1;
    }
    // Tied guesses = draw for this round (no points)
  }

  const players = getPlayerList(room);
  if (winnerId) {
    winnerName = players.find((p) => p.id === winnerId)?.name ?? null;
  }

  // Reveal both players' grids to each other
  io.to(room.id).emit("wdl_round_result", {
    winnerId,
    winnerName,
    answer:      round.answer,
    scores:      match.scores,
    roundNumber: match.round,
    playerResults: {
      [p1.id]: { guesses: pr1.guesses, solved: pr1.solved },
      [p2.id]: { guesses: pr2.guesses, solved: pr2.solved },
    },
  });

  console.log(`[wdl] round ${match.round} — ${winnerName ?? "draw"} | answer: ${round.answer}`);

  const snap = match.round;
  setTimeout(() => {
    if (!isSafe(room)) return;
    if (!room.state.wdl || room.state.wdl.match.round !== snap) return;
    startRound(io, room);
  }, ROUND_END_DELAY);
}

// ── End match ─────────────────────────────────────────────────────────────────

export function handleWdlEndMatch(io, socket, room) {
  if (!room.state.wdl) return;

  const { match } = room.state.wdl;
  if (room.state.wdl.round) room.state.wdl.round.finished = true;

  const [p1, p2] = room.players;

  let overallWinnerId = null;
  if (match.scores[p1.id] > match.scores[p2.id])      overallWinnerId = p1.id;
  else if (match.scores[p2.id] > match.scores[p1.id]) overallWinnerId = p2.id;

  const players    = getPlayerList(room);
  const winnerName = overallWinnerId
    ? players.find((p) => p.id === overallWinnerId)?.name ?? null
    : null;

  io.to(room.id).emit("wdl_match_over", {
    winnerId:    overallWinnerId,
    winnerName,
    scores:      match.scores,
    totalRounds: match.round,
  });

  room.state.wdl = null;
  console.log(`[wdl] match over — ${winnerName ?? "draw"}`);
}

// ── Forfeit ───────────────────────────────────────────────────────────────────

export function handleWdlForfeit(io, room, disconnectedPlayerId) {
  if (!room.state.wdl) return;

  const { match } = room.state.wdl;
  if (room.state.wdl.round) room.state.wdl.round.finished = true;

  const players = getPlayerList(room);
  const winner  = players.find((p) => p.id !== disconnectedPlayerId);

  io.to(room.id).emit("wdl_match_over", {
    winnerId:    winner?.id ?? null,
    winnerName:  winner?.name ?? null,
    scores:      match.scores,
    totalRounds: match.round,
    reason:      "forfeit",
  });

  room.state.wdl = null;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function cleanupWordleDuel(room) {
  if (!room.state.wdl) return;
  if (room.state.wdl.round) room.state.wdl.round.finished = true;
  room.state.wdl = null;
  console.log(`[wdl] cleaned up room ${room.id}`);
}
