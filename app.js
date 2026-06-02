const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const state = {
  board: Array(9).fill(""),
  current: "X",
  mode: "ai",
  difficulty: "hard",
  humanMark: "X",
  aiMark: "O",
  locked: false,
  gameOver: false,
  sound: true,
  roundStarted: false,
  score: { X: 0, O: 0, draw: 0, rounds: 0 },
};

const cells = [...document.querySelectorAll(".cell")];
const turnLabel = document.querySelector("#turnLabel");
const messageBar = document.querySelector("#messageBar");
const scoreX = document.querySelector("#scoreX");
const scoreO = document.querySelector("#scoreO");
const scoreDraw = document.querySelector("#scoreDraw");
const roundCount = document.querySelector("#roundCount");
const aiRead = document.querySelector("#aiRead");
const difficulty = document.querySelector("#difficulty");
const difficultyGroup = document.querySelector("#difficultyGroup");
const soundToggle = document.querySelector("#soundToggle");
const firstMoveToggle = document.querySelector("#firstMoveToggle");
const animationToggle = document.querySelector("#animationToggle");

let audioContext;
let aiTimer;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function playSound(type) {
  if (!state.sound) return;

  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  const osc = ctx.createOscillator();
  const tone = {
    move: [520, 0.07, "sine"],
    ai: [310, 0.09, "triangle"],
    win: [740, 0.2, "sine"],
    lose: [180, 0.18, "sawtooth"],
    draw: [420, 0.14, "square"],
    reset: [260, 0.08, "triangle"],
  }[type] || [440, 0.08, "sine"];

  osc.type = tone[2];
  osc.frequency.setValueAtTime(tone[0], now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(80, tone[0] * 1.38), now + tone[1]);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + tone[1]);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + tone[1] + 0.02);
}

function availableMoves(board = state.board) {
  return board.map((value, index) => (value ? null : index)).filter((index) => index !== null);
}

function winnerFor(board = state.board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a], line };
    }
  }

  if (board.every(Boolean)) {
    return { mark: "draw", line: [] };
  }

  return null;
}

function setMessage(text) {
  messageBar.textContent = text;
}

function updateScoreboard() {
  scoreX.textContent = state.score.X;
  scoreO.textContent = state.score.O;
  scoreDraw.textContent = state.score.draw;
  roundCount.textContent = state.score.rounds;
}

function updateTurn() {
  if (state.gameOver) return;

  const name = state.mode === "ai" && state.current === state.aiMark ? "AI" : `Player ${state.current}`;
  turnLabel.textContent = name;
}

function renderBoard(lastMove = null) {
  cells.forEach((cell, index) => {
    const mark = state.board[index];
    cell.className = "cell";
    cell.disabled = Boolean(mark) || state.locked || state.gameOver;
    cell.setAttribute("aria-label", mark ? `Cell ${index + 1}, ${mark}` : `Cell ${index + 1}, empty`);
    if (mark) cell.classList.add(mark.toLowerCase());
    if (index === lastMove && animationToggle.checked) {
      cell.classList.add("pulse");
      window.setTimeout(() => cell.classList.remove("pulse"), 450);
    }
  });
  updateTurn();
}

function finishGame(result) {
  state.gameOver = true;
  state.locked = false;
  state.score.rounds += 1;

  if (result.mark === "draw") {
    state.score.draw += 1;
    turnLabel.textContent = "Draw";
    setMessage("A clean draw. That board gave nothing away.");
    playSound("draw");
  } else {
    state.score[result.mark] += 1;
    turnLabel.textContent = `${result.mark} wins`;
    result.line.forEach((index) => cells[index].classList.add("win"));

    const humanWon = state.mode === "human" || result.mark === state.humanMark;
    setMessage(humanWon ? `Player ${result.mark} wins with style.` : "The AI found the line and closed the round.");
    playSound(humanWon ? "win" : "lose");
  }

  updateScoreboard();
  cells.forEach((cell) => (cell.disabled = true));
}

function commitMove(index, mark, soundType = "move") {
  if (state.board[index] || state.gameOver) return false;

  state.roundStarted = true;
  state.board[index] = mark;
  renderBoard(index);
  playSound(soundType);

  const result = winnerFor();
  if (result) {
    finishGame(result);
    return true;
  }

  state.current = mark === "X" ? "O" : "X";
  updateTurn();
  return true;
}

function findImmediateMove(board, mark) {
  return availableMoves(board).find((index) => {
    const copy = [...board];
    copy[index] = mark;
    return winnerFor(copy)?.mark === mark;
  });
}

function mediumMove(board, aiMark, humanMark) {
  const win = findImmediateMove(board, aiMark);
  if (win !== undefined) return win;

  const block = findImmediateMove(board, humanMark);
  if (block !== undefined) return block;

  if (!board[4]) return 4;

  const corners = [0, 2, 6, 8].filter((index) => !board[index]);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];

  const moves = availableMoves(board);
  return moves[Math.floor(Math.random() * moves.length)];
}

function minimax(board, turn, aiMark, humanMark, depth = 0, alpha = -Infinity, beta = Infinity) {
  const result = winnerFor(board);
  if (result) {
    if (result.mark === aiMark) return 10 - depth;
    if (result.mark === humanMark) return depth - 10;
    return 0;
  }

  const maximizing = turn === aiMark;
  let bestScore = maximizing ? -Infinity : Infinity;
  const nextTurn = turn === "X" ? "O" : "X";

  for (const move of availableMoves(board)) {
    board[move] = turn;
    const score = minimax(board, nextTurn, aiMark, humanMark, depth + 1, alpha, beta);
    board[move] = "";

    if (maximizing) {
      bestScore = Math.max(bestScore, score);
      alpha = Math.max(alpha, score);
    } else {
      bestScore = Math.min(bestScore, score);
      beta = Math.min(beta, score);
    }

    if (beta <= alpha) break;
  }

  return bestScore;
}

function hardMove(board, aiMark, humanMark) {
  let bestScore = -Infinity;
  let bestMoves = [];

  for (const move of availableMoves(board)) {
    board[move] = aiMark;
    const score = minimax(board, humanMark, aiMark, humanMark);
    board[move] = "";

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function expertMove(board, aiMark, humanMark) {
  if (board.every((value) => !value)) {
    return [0, 2, 4, 6, 8][Math.floor(Math.random() * 5)];
  }

  return hardMove(board, aiMark, humanMark);
}

function chooseAiMove() {
  const moves = availableMoves();
  if (!moves.length) return null;

  if (state.difficulty === "easy") {
    aiRead.textContent = "Loose";
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (state.difficulty === "medium") {
    aiRead.textContent = "Tactical";
    return mediumMove([...state.board], state.aiMark, state.humanMark);
  }

  if (state.difficulty === "expert") {
    aiRead.textContent = "Clinical";
    return expertMove([...state.board], state.aiMark, state.humanMark);
  }

  aiRead.textContent = "Deep";
  return hardMove([...state.board], state.aiMark, state.humanMark);
}

function queueAiTurn() {
  if (state.mode !== "ai" || state.current !== state.aiMark || state.gameOver) return;

  state.locked = true;
  renderBoard();
  setMessage("The AI is reading the board...");

  aiTimer = window.setTimeout(() => {
    const move = chooseAiMove();
    if (move !== null) {
      commitMove(move, state.aiMark, "ai");
      if (!state.gameOver) setMessage("Your move. Break the pattern.");
    }
    state.locked = false;
    if (!state.gameOver) renderBoard(move);
  }, state.difficulty === "easy" ? 380 : 620);
}

function handleCellClick(event) {
  const index = Number(event.currentTarget.dataset.cell);
  if (state.locked || state.gameOver || state.board[index]) return;
  if (state.mode === "ai" && state.current !== state.humanMark) return;

  const moved = commitMove(index, state.current, "move");
  if (!moved || state.gameOver) return;

  if (state.mode === "ai") {
    queueAiTurn();
  } else {
    setMessage(`Player ${state.current}, the board is yours.`);
  }
}

function newRound(options = {}) {
  window.clearTimeout(aiTimer);
  state.board = Array(9).fill("");
  state.gameOver = false;
  state.locked = false;
  state.roundStarted = false;
  state.current = firstMoveToggle.checked ? "X" : state.humanMark === "X" ? "O" : "X";
  state.aiMark = state.humanMark === "X" ? "O" : "X";
  aiRead.textContent = state.mode === "ai" ? "Waiting" : "Off";
  renderBoard();
  if (!options.silent) playSound("reset");

  if (state.mode === "ai" && state.current === state.aiMark) {
    setMessage("AI opens the round.");
    queueAiTurn();
  } else {
    setMessage(`${state.mode === "ai" ? "Your" : `Player ${state.current}'s`} move. Aim for control.`);
  }
}

function resetScore() {
  state.score = { X: 0, O: 0, draw: 0, rounds: 0 };
  updateScoreboard();
  setMessage("Scoreboard reset. Fresh pressure.");
  playSound("reset");
}

function updateMode(mode) {
  state.mode = mode;
  difficultyGroup.style.display = mode === "ai" ? "grid" : "none";
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  newRound();
}

function updatePlayer(mark) {
  state.humanMark = mark;
  state.aiMark = mark === "X" ? "O" : "X";
  document.querySelectorAll("[data-player]").forEach((button) => {
    button.classList.toggle("active", button.dataset.player === mark);
  });
  newRound();
}

cells.forEach((cell) => cell.addEventListener("click", handleCellClick));

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => updateMode(button.dataset.mode));
});

document.querySelectorAll("[data-player]").forEach((button) => {
  button.addEventListener("click", () => updatePlayer(button.dataset.player));
});

difficulty.addEventListener("change", () => {
  state.difficulty = difficulty.value;
  newRound();
});

firstMoveToggle.addEventListener("change", newRound);
animationToggle.addEventListener("change", () => setMessage(animationToggle.checked ? "Finish animation enabled." : "Finish animation disabled."));
document.querySelector("#newRound").addEventListener("click", newRound);
document.querySelector("#resetScore").addEventListener("click", resetScore);

soundToggle.addEventListener("click", () => {
  state.sound = !state.sound;
  soundToggle.classList.toggle("muted", !state.sound);
  soundToggle.setAttribute("aria-label", state.sound ? "Sound on" : "Sound off");
  setMessage(state.sound ? "Sound effects enabled." : "Sound effects muted.");
  if (state.sound) playSound("move");
});

updateScoreboard();
newRound({ silent: true });
