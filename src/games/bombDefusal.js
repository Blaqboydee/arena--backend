/**
 * bombDefusal.js
 * Co-op puzzle game (2–4 players). Inspired by "Keep Talking and Nobody Explodes".
 *
 * One player is the "Defuser" — they see bomb modules.
 * Others are "Experts" — they see instruction manuals but NOT the bomb.
 * Players communicate to solve modules before time runs out.
 *
 * Modules:
 *   1. Wire Cut    — 4 colored wires, cut the correct one based on rules
 *   2. Keypad      — 4 symbols, press in the correct order
 *   3. Simon Says  — Color sequence, repeat in mapped order
 *
 * Each match has 3 modules. Timer: 120s. One strike allowed (wrong answer).
 * Two strikes = bomb explodes. Solve all 3 = team wins.
 */

import { getPlayerList } from "../platform/roomManager.js";

const BOMB_TIME_MS     = 120_000;
const MODULE_COUNT     = 3;
const MAX_STRIKES      = 2;

// ── Wire module rules ─────────────────────────────────────────────────────────

const WIRE_COLORS = ["red", "blue", "yellow", "white", "black", "green"];

function generateWireModule() {
  const count = 3 + Math.floor(Math.random() * 3); // 3 to 5 wires
  const wires = [];
  for (let i = 0; i < count; i++) {
    wires.push(WIRE_COLORS[Math.floor(Math.random() * WIRE_COLORS.length)]);
  }

  // Determine correct wire to cut based on rules
  let correctIndex;
  const redCount = wires.filter(w => w === "red").length;
  const blueCount = wires.filter(w => w === "blue").length;
  const lastWire = wires[wires.length - 1];

  if (count === 3) {
    if (redCount === 0) correctIndex = 1;      // cut 2nd wire
    else if (lastWire === "white") correctIndex = count - 1;  // cut last
    else if (blueCount > 1) correctIndex = wires.lastIndexOf("blue");
    else correctIndex = count - 1;
  } else if (count === 4) {
    if (redCount > 1) correctIndex = wires.lastIndexOf("red");
    else if (lastWire === "yellow" && redCount === 0) correctIndex = 0;
    else if (blueCount === 1) correctIndex = 0;
    else if (wires.filter(w => w === "yellow").length > 1) correctIndex = count - 1;
    else correctIndex = 1;
  } else {
    if (lastWire === "black") correctIndex = 3;
    else if (redCount === 1) correctIndex = 0;
    else if (wires.filter(w => w === "yellow").length > 1) correctIndex = count - 1;
    else correctIndex = 1;
  }

  // Build the manual rule text for experts
  const rules = buildWireRules(count);

  return {
    type: "wires",
    wires,
    wireCount: count,
    correctIndex,
    rules,
    solved: false,
  };
}

function buildWireRules(count) {
  if (count === 3) {
    return [
      "If there are no red wires, cut the second wire.",
      "Otherwise, if the last wire is white, cut the last wire.",
      "Otherwise, if there is more than one blue wire, cut the last blue wire.",
      "Otherwise, cut the last wire.",
    ];
  } else if (count === 4) {
    return [
      "If there is more than one red wire, cut the last red wire.",
      "Otherwise, if the last wire is yellow and there are no red wires, cut the first wire.",
      "Otherwise, if there is exactly one blue wire, cut the first wire.",
      "Otherwise, if there is more than one yellow wire, cut the last wire.",
      "Otherwise, cut the second wire.",
    ];
  } else {
    return [
      "If the last wire is black, cut the fourth wire.",
      "Otherwise, if there is exactly one red wire, cut the first wire.",
      "Otherwise, if there is more than one yellow wire, cut the last wire.",
      "Otherwise, cut the second wire.",
    ];
  }
}

// ── Keypad module ─────────────────────────────────────────────────────────────

const SYMBOL_COLUMNS = [
  ["Ω", "Ψ", "©", "Ж", "★", "¿", "Φ"],
  ["Σ", "Ω", "©", "Ξ", "Ж", "Λ", "★"],
  ["Ψ", "Ξ", "Φ", "★", "Λ", "Σ", "¿"],
  ["Ж", "Ψ", "Ξ", "Ω", "©", "Σ", "Φ"],
];

function generateKeypadModule() {
  // Pick a column that has 4 symbols we can use
  const colIdx = Math.floor(Math.random() * SYMBOL_COLUMNS.length);
  const column = SYMBOL_COLUMNS[colIdx];

  // Pick 4 random symbols from this column
  const indices = [];
  const available = [...column.keys()];
  for (let i = 0; i < 4; i++) {
    const pick = Math.floor(Math.random() * available.length);
    indices.push(available[pick]);
    available.splice(pick, 1);
  }

  // The display order is shuffled
  const shuffled = [...indices].sort(() => Math.random() - 0.5);
  const symbols = shuffled.map(i => column[i]);

  // Correct order is by their position in the column (ascending)
  const correctOrder = [...indices].sort((a, b) => a - b).map(i => column[i]);

  return {
    type: "keypad",
    symbols,          // what the defuser sees (shuffled)
    correctOrder,     // correct order to press
    columns: SYMBOL_COLUMNS, // manual reference (experts see all columns)
    pressed: [],
    solved: false,
  };
}

// ── Simon Says module ─────────────────────────────────────────────────────────

const SIMON_COLORS = ["red", "blue", "green", "yellow"];

// Mapping changes based on number of strikes
const SIMON_MAPS = {
  0: { red: "blue", blue: "red", green: "yellow", yellow: "green" },
  1: { red: "yellow", blue: "green", green: "red", yellow: "blue" },
};

function generateSimonModule() {
  const seqLength = 3 + Math.floor(Math.random() * 2); // 3–4
  const sequence = [];
  for (let i = 0; i < seqLength; i++) {
    sequence.push(SIMON_COLORS[Math.floor(Math.random() * SIMON_COLORS.length)]);
  }

  return {
    type: "simon",
    sequence,       // flashing sequence the defuser sees
    currentStep: 0, // which sub-sequence we're currently on (1, then 1-2, then 1-2-3...)
    inputSoFar: [],
    solved: false,
  };
}

function getSimonAnswer(sequence, step, strikes) {
  const map = SIMON_MAPS[Math.min(strikes, 1)];
  return sequence.slice(0, step + 1).map(c => map[c]);
}

// ── Main engine ───────────────────────────────────────────────────────────────

function isSafe(room) {
  return room.state.bomb !== null && room.players.length >= 2;
}

function clearTimer(room) {
  const timer = room.state.bomb?.timer;
  if (timer) {
    clearTimeout(timer);
    room.state.bomb.timer = null;
  }
}

export function startBombDefusal(io, room) {
  const defuser = room.players[0]; // First player is the defuser

  const modules = [
    generateWireModule(),
    generateKeypadModule(),
    generateSimonModule(),
  ];

  room.state.bomb = {
    defuserId:    defuser.id,
    modules,
    strikes:      0,
    maxStrikes:   MAX_STRIKES,
    startTime:    Date.now(),
    timeLimit:    BOMB_TIME_MS,
    timer:        null,
    phase:        "active", // active | defused | exploded
    currentModule: 0,
  };

  const players = getPlayerList(room);

  // Send role assignments
  room.players.forEach((p) => {
    const isDefuser = p.id === defuser.id;
    p.emit("bomb_start", {
      role:          isDefuser ? "defuser" : "expert",
      defuserId:     defuser.id,
      timeLimit:     BOMB_TIME_MS,
      moduleCount:   MODULE_COUNT,
      players,
    });
  });

  emitState(io, room);

  // Start the countdown
  room.state.bomb.timer = setTimeout(() => {
    if (!room.state.bomb || room.state.bomb.phase !== "active") return;
    explode(io, room);
  }, BOMB_TIME_MS);

  console.log(`[bomb] started — defuser: ${defuser.id}, ${room.players.length} players`);
}

// targetSocket: if provided, sends state only to that socket; otherwise broadcasts to all players
function emitState(io, room, targetSocket = null) {
  if (!room.state.bomb) return;
  const { bomb } = room.state;
  const players = getPlayerList(room);

  const elapsed = Date.now() - bomb.startTime;
  const timeRemaining = Math.max(0, bomb.timeLimit - elapsed);

  const targets = targetSocket
    ? room.players.filter(p => p.id === targetSocket.id)
    : room.players;

  targets.forEach((p) => {
    const isDefuser = p.id === bomb.defuserId;

    // Defuser sees module visuals (but NOT the rules/manual)
    // Experts see the rules/manual (but NOT the module visuals)
    const moduleData = bomb.modules.map((mod, i) => {
      if (isDefuser) {
        // Defuser view: see the puzzle, not the answers
        if (mod.type === "wires") {
          return { type: "wires", index: i, wires: mod.wires, wireCount: mod.wireCount, solved: mod.solved };
        }
        if (mod.type === "keypad") {
          return { type: "keypad", index: i, symbols: mod.symbols, pressed: mod.pressed, solved: mod.solved };
        }
        if (mod.type === "simon") {
          const subSeq = mod.sequence.slice(0, mod.currentStep + 1);
          return { type: "simon", index: i, sequence: subSeq, inputSoFar: mod.inputSoFar, solved: mod.solved };
        }
      } else {
        // Expert view: see the manual/rules, not the puzzle
        if (mod.type === "wires") {
          return { type: "wires", index: i, rules: mod.rules, wireCount: mod.wireCount, solved: mod.solved };
        }
        if (mod.type === "keypad") {
          return { type: "keypad", index: i, columns: mod.columns, solved: mod.solved };
        }
        if (mod.type === "simon") {
          return {
            type: "simon", index: i,
            colorMap: SIMON_MAPS[Math.min(bomb.strikes, 1)],
            strikeCount: bomb.strikes,
            solved: mod.solved,
          };
        }
      }
      return { type: mod.type, index: i, solved: mod.solved };
    });

    p.emit("bomb_state", {
      modules:       moduleData,
      strikes:       bomb.strikes,
      maxStrikes:    bomb.maxStrikes,
      timeRemaining,
      phase:         bomb.phase,
      currentModule: bomb.currentModule,
      players,
    });
  });
}

// Re-sends bomb_start + bomb_state to a single socket that missed the initial broadcast
export function handleBombRequestState(io, socket, room) {
  if (!room.state.bomb || room.state.bomb.phase !== "active") return;
  const { bomb } = room.state;
  const players = getPlayerList(room);
  const isDefuser = socket.id === bomb.defuserId;

  socket.emit("bomb_start", {
    role:        isDefuser ? "defuser" : "expert",
    defuserId:   bomb.defuserId,
    timeLimit:   bomb.timeLimit,
    moduleCount: MODULE_COUNT,
    players,
  });

  emitState(io, room, socket);
}

// ── Action handlers ───────────────────────────────────────────────────────────

export function handleBombAction(io, socket, room, action) {
  if (!room.state.bomb) return;
  const { bomb } = room.state;
  if (bomb.phase !== "active") return;
  if (socket.id !== bomb.defuserId) return; // Only defuser can interact

  const { moduleIndex, data } = action;
  if (typeof moduleIndex !== "number" || moduleIndex < 0 || moduleIndex >= MODULE_COUNT) return;

  const mod = bomb.modules[moduleIndex];
  if (mod.solved) return;

  let correct = false;

  if (mod.type === "wires" && typeof data?.wireIndex === "number") {
    correct = data.wireIndex === mod.correctIndex;
    if (correct) {
      mod.solved = true;
    }
  } else if (mod.type === "keypad" && typeof data?.symbol === "string") {
    const nextExpected = mod.correctOrder[mod.pressed.length];
    if (data.symbol === nextExpected) {
      mod.pressed.push(data.symbol);
      if (mod.pressed.length === mod.correctOrder.length) {
        mod.solved = true;
        correct = true;
      } else {
        // Partially correct — not a strike
        emitState(io, room);
        return;
      }
    } else {
      // Wrong symbol — reset and strike
      mod.pressed = [];
      correct = false;
    }
  } else if (mod.type === "simon" && typeof data?.color === "string") {
    const expected = getSimonAnswer(mod.sequence, mod.currentStep, bomb.strikes);
    const nextExpected = expected[mod.inputSoFar.length];

    if (data.color === nextExpected) {
      mod.inputSoFar.push(data.color);
      if (mod.inputSoFar.length === expected.length) {
        // Completed this sub-sequence
        mod.currentStep += 1;
        mod.inputSoFar = [];
        if (mod.currentStep >= mod.sequence.length) {
          mod.solved = true;
          correct = true;
        } else {
          // Next sub-sequence
          emitState(io, room);
          return;
        }
      } else {
        // Partially correct
        emitState(io, room);
        return;
      }
    } else {
      // Wrong color — strike and reset input
      mod.inputSoFar = [];
      correct = false;
    }
  } else {
    return; // Invalid action
  }

  if (!correct && !mod.solved) {
    bomb.strikes += 1;

    io.to(room.id).emit("bomb_strike", {
      strikes: bomb.strikes,
      maxStrikes: bomb.maxStrikes,
      moduleIndex,
    });

    if (bomb.strikes >= bomb.maxStrikes) {
      explode(io, room);
      return;
    }
  }

  // Check if all modules solved
  if (bomb.modules.every(m => m.solved)) {
    defuse(io, room);
    return;
  }

  emitState(io, room);
}

function defuse(io, room) {
  if (!room.state.bomb) return;
  const { bomb } = room.state;
  bomb.phase = "defused";
  clearTimer(room);

  const elapsed = Date.now() - bomb.startTime;
  const players = getPlayerList(room);

  io.to(room.id).emit("bomb_result", {
    success:       true,
    timeUsed:      elapsed,
    strikes:       bomb.strikes,
    players,
  });

  room.state.bomb = null;
  console.log(`[bomb] defused! ${elapsed}ms, ${bomb.strikes} strikes`);
}

function explode(io, room) {
  if (!room.state.bomb) return;
  const { bomb } = room.state;
  bomb.phase = "exploded";
  clearTimer(room);

  const elapsed = Date.now() - bomb.startTime;
  const players = getPlayerList(room);

  const reason = bomb.strikes >= bomb.maxStrikes ? "strikes" : "timeout";

  io.to(room.id).emit("bomb_result", {
    success:   false,
    reason,
    timeUsed:  elapsed,
    strikes:   bomb.strikes,
    players,
  });

  room.state.bomb = null;
  console.log(`[bomb] exploded! reason: ${reason}`);
}

// ── End / forfeit ─────────────────────────────────────────────────────────────

export function handleBombEndMatch(io, socket, room) {
  if (!room.state.bomb) return;
  explode(io, room);
}

export function handleBombForfeit(io, room, disconnectedPlayerId) {
  if (!room.state.bomb) return;

  // If defuser left, game is over
  if (disconnectedPlayerId === room.state.bomb.defuserId || room.players.length < 2) {
    explode(io, room);
    return;
  }

  // Expert left — notify but continue if enough players
  const players = getPlayerList(room);
  io.to(room.id).emit("bomb_player_left", {
    playerId: disconnectedPlayerId,
    players,
    remainingCount: room.players.length,
  });
}

export function cleanupBombDefusal(room) {
  if (!room.state.bomb) return;
  clearTimer(room);
  room.state.bomb = null;
  console.log(`[bomb] cleaned up room ${room.id}`);
}
