// script.js

// Game Constants & Configuration
const ROWS = 13;
const COLS = 10;
const BLOCK_SIZE = 30;
const COLORS = [
  null,
  '#9d4edd', // I - purple
  '#3a0ca3', // J - dark purple
  '#4361ee', // L - light blue
  '#720026', // O - deep purple
  '#90e0ef', // S - light blue
  '#b5179e', // T - pinkish purple
  '#560bad', // Z - dark purple
];

// Tetromino Shapes
const SHAPES = [
  // I
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  // J
  [
    [0, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  // L
  [
    [0, 1, 1],
    [0, 1, 1],
    [0, 1, 1],
  ],
  // O
  [
    [1, 1],
    [1, 1],
  ],
  // S
  [
    [0, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
  ],
  // T
  [
    [0, 0, 0],
    [1, 1, 1],
    [1, 1, 1],
  ],
  // Z
  [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
  ],
];

// Message phrases to reveal (love letter lines)
const MESSAGE_LETTERS = [
  ' Hi Bam💝',
  'I Love You.',
  'Wait lang ha, may 2nd page pa',
  '12 ka lines gub-a',
];
const REVEAL_THRESHOLD = 1; // Lines needed to reveal a phrase

// Game State
let canvas, ctx, nextCanvas, nextCtx;
let board = createMatrix(COLS, ROWS);
let dropCounter = 0;
let dropInterval = 2000;
let lastTime = 0;
let gameOver = false;
let paused = false;
let score = 0;
let linesCleared = 0;
let totalLinesCleared = 0;
let revealedLetters = 0;
let player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  next: null,
};

function init() {
  canvas = document.getElementById('tetris');
  ctx = canvas.getContext('2d');
  nextCanvas = document.getElementById('next');
  nextCtx = nextCanvas.getContext('2d');

  const scale = window.devicePixelRatio || 1;
  canvas.width = COLS * BLOCK_SIZE * scale;
  canvas.height = ROWS * BLOCK_SIZE * scale;
  ctx.scale(scale, scale);

  nextCanvas.width = 4 * BLOCK_SIZE * scale;
  nextCanvas.height = 4 * BLOCK_SIZE * scale;
  nextCtx.scale(scale, scale);

  resetGame();
  updateScore();
  updateMessageDisplay();

  document.getElementById('start-button').addEventListener('click', () => {
    if (gameOver) {
      resetGame();
    }
    paused = false;
    gameOver = false;
  });

  document.getElementById('pause-button').addEventListener('click', () => {
    paused = !paused;
  });

  // Mobile control buttons
  document.getElementById('left-btn').addEventListener('click', () => move(-1));
  document.getElementById('right-btn').addEventListener('click', () => move(1));
  document.getElementById('rotate-btn').addEventListener('click', rotate);
  document.getElementById('drop-btn').addEventListener('click', () => drop());

  // Keyboard controls
  document.addEventListener('keydown', (event) => {
    if (paused || gameOver) return;

    switch (event.keyCode) {
      case 65: // A
        move(-1);
        break;
      case 68: // D
        move(1);
        break;
      case 83: // S
        drop();
        break;
      case 69: // E
        rotate();
        break;
      case 81: // Q
        hardDrop();
        break;
      case 80: // P
        paused = !paused;
        break;
    }
  });

  // Touch controls for mobile
  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener('touchstart', (event) => {
    if (paused || gameOver) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', (event) => {
    if (paused || gameOver) return;

    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;

    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) > 30 || Math.abs(diffY) > 30) {
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) {
          move(1);
        } else {
          move(-1);
        }
      } else {
        if (diffY > 0) {
          drop();
        } else {
          rotate();
        }
      }
    } else {
      rotate();
    }

    event.preventDefault();
  }, { passive: false });

  requestAnimationFrame(gameLoop);
}

function createMatrix(w, h) {
  const matrix = [];
  for (let i = 0; i < h; i++) {
    matrix.push(new Array(w).fill(0));
  }
  return matrix;
}

function createPiece(type) {
  return SHAPES[type];
}

function playerReset() {
  player.matrix = player.next;
  player.next = createPiece(Math.floor(Math.random() * SHAPES.length));
  player.pos.y = 0;
  player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);

  if (collide(board, player)) {
    gameOver = true;
  }

  drawNext();
}

function drawNext() {
  nextCtx.fillStyle = '#1c1c54';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const next = player.next;
  const offset = {
    x: (4 - next[0].length) / 2,
    y: (4 - next.length) / 2,
  };

  next.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        nextCtx.fillStyle = COLORS[value];
        nextCtx.fillRect(
          (x + offset.x) * BLOCK_SIZE,
          (y + offset.y) * BLOCK_SIZE,
          BLOCK_SIZE,
          BLOCK_SIZE
        );

        nextCtx.strokeStyle = 'white';
        nextCtx.lineWidth = 1;
        nextCtx.strokeRect(
          (x + offset.x) * BLOCK_SIZE,
          (y + offset.y) * BLOCK_SIZE,
          BLOCK_SIZE,
          BLOCK_SIZE
        );
      }
    });
  });
}

function collide(board, player) {
  const [m, o] = [player.matrix, player.pos];
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 && 
          (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

function merge(board, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        board[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = COLORS[value];
        ctx.fillRect(
          (x + offset.x) * BLOCK_SIZE,
          (y + offset.y) * BLOCK_SIZE,
          BLOCK_SIZE,
          BLOCK_SIZE
        );

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          (x + offset.x) * BLOCK_SIZE,
          (y + offset.y) * BLOCK_SIZE,
          BLOCK_SIZE,
          BLOCK_SIZE
        );

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(
          (x + offset.x) * BLOCK_SIZE + 2,
          (y + offset.y) * BLOCK_SIZE + 2,
          BLOCK_SIZE - 4,
          4
        );

        ctx.fillRect(
          (x + offset.x) * BLOCK_SIZE + 2,
          (y + offset.y) * BLOCK_SIZE + 2,
          4,
          BLOCK_SIZE - 4
        );
      }
    });
  });
}

function draw() {
  ctx.fillStyle = '#1c1c54';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 0.5;

  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK_SIZE, 0);
    ctx.lineTo(x * BLOCK_SIZE, ROWS * BLOCK_SIZE);
    ctx.stroke();
  }

  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK_SIZE);
    ctx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE);
    ctx.stroke();
  }

  drawMatrix(board, { x: 0, y: 0 });
  drawMatrix(player.matrix, player.pos);
}

function move(dir) {
  player.pos.x += dir;
  if (collide(board, player)) {
    player.pos.x -= dir;
  }
}

function rotate() {
  const pos = player.pos.x;
  let offset = 1;
  rotateMatrix(player.matrix, 1);

  while (collide(board, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotateMatrix(player.matrix, -1);
      player.pos.x = pos;
      return;
    }
  }
}

function rotateMatrix(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }

  if (dir > 0) {
    matrix.forEach(row => row.reverse());
  } else {
    matrix.reverse();
  }
}

function drop() {
  player.pos.y++;
  if (collide(board, player)) {
    player.pos.y--;
    merge(board, player);
    playerReset();
    clearLines();
    updateScore();
  }
  dropCounter = 0;
}

function hardDrop() {
  while (!collide(board, player)) {
    player.pos.y++;
  }
  player.pos.y--;
  merge(board, player);
  playerReset();
  clearLines();
  updateScore();
}

function clearLines() {
  let rowCount = 0;

  outer: for (let y = ROWS - 1; y >= 0; --y) {
    for (let x = 0; x < COLS; ++x) {
      if (board[y][x] === 0) {
        continue outer;
      }
    }

    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    ++rowCount;
    ++y;
  }

  if (rowCount > 0) {
    linesCleared += rowCount;
    totalLinesCleared += rowCount;
    score += rowCount * 10;

    updateScore();

    // Reveal message letters every 1 lines cleared
    if (linesCleared >= REVEAL_THRESHOLD) {
      linesCleared = 2;
      if (revealedLetters < MESSAGE_LETTERS.length) {
        revealedLetters++;
        updateMessageDisplay();
      }
    }

    // Redirect after 12 lines cleared (3 Tetrises)
    if (totalLinesCleared >= 12) {
      alert('Congrats! You cleared 12 lines! HUMANDA KA!!');
      window.location.href = '2ndpage.html'; // Change to your target page
    }
  }
}

function updateScore() {
  document.getElementById('score').textContent = score;
}

function updateMessageDisplay() {
  if (revealedLetters === 0) {
    document.getElementById('message-display').textContent = '6 words';
  } else {
    // Join revealed messages with line breaks
    const message = MESSAGE_LETTERS.slice(0, revealedLetters).join('\n');
    document.getElementById('message-display').textContent = message;
  }

  document.getElementById('letter-indicator').textContent = 
    `Next letter after ${REVEAL_THRESHOLD} line${REVEAL_THRESHOLD > 1 ? 's' : ''}`;

  // If you have these elements, update them as well:
  if (document.getElementById('line-indicator')) {
    document.getElementById('line-indicator').textContent = `Next Page after 12 lines`;
  }
  if (document.getElementById('line-indicator1')) {
    document.getElementById('line-indicator1').textContent = `Now: ${totalLinesCleared}`;
  }
}

function gameLoop(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  if (!paused && !gameOver) {
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      drop();
    }
  }

  draw();
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  board = createMatrix(COLS, ROWS);
  player.next = createPiece(Math.floor(Math.random() * SHAPES.length));
  playerReset();
  score = 0;
  linesCleared = 0;
  totalLinesCleared = 0;
  revealedLetters = 0;
  gameOver = false;
  paused = false;
  updateScore();
  updateMessageDisplay();
}

// Initialize the game
init();
