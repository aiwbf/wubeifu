const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const coinCountEl = document.getElementById("coin-count");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart");

const gravity = 0.6;
const friction = 0.85;

const keys = {
  left: false,
  right: false,
  jump: false,
};

const level = {
  groundY: 480,
  platforms: [
    { x: 80, y: 390, w: 160, h: 18 },
    { x: 310, y: 330, w: 130, h: 18 },
    { x: 520, y: 290, w: 160, h: 18 },
    { x: 760, y: 250, w: 140, h: 18 },
  ],
  coins: [
    { x: 120, y: 350, r: 10, collected: false },
    { x: 355, y: 290, r: 10, collected: false },
    { x: 580, y: 250, r: 10, collected: false },
    { x: 815, y: 210, r: 10, collected: false },
  ],
  goal: { x: 880, y: 150, w: 20, h: 110 },
};

let player;
let gameState = "playing";

const resetPlayer = () => {
  player = {
    x: 60,
    y: level.groundY - 48,
    w: 34,
    h: 48,
    vx: 0,
    vy: 0,
    canJump: false,
  };
};

const resetGame = () => {
  level.coins.forEach((coin) => {
    coin.collected = false;
  });
  resetPlayer();
  gameState = "playing";
  statusEl.textContent = "冒险中";
  coinCountEl.textContent = "0";
};

const handleKey = (event, isDown) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    keys.left = isDown;
  }
  if (event.code === "ArrowRight" || event.code === "KeyD") {
    keys.right = isDown;
  }
  if (event.code === "Space") {
    keys.jump = isDown;
  }
};

const overlap = (a, b) => {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
};

const updatePlayer = () => {
  if (keys.left) {
    player.vx -= 0.6;
  }
  if (keys.right) {
    player.vx += 0.6;
  }

  if (keys.jump && player.canJump) {
    player.vy = -11.5;
    player.canJump = false;
  }

  player.vx *= friction;
  player.vy += gravity;

  player.x += player.vx;
  player.y += player.vy;

  if (player.x < 0) player.x = 0;
  if (player.x + player.w > canvas.width) player.x = canvas.width - player.w;

  if (player.y + player.h >= level.groundY) {
    player.y = level.groundY - player.h;
    player.vy = 0;
    player.canJump = true;
  }

  level.platforms.forEach((platform) => {
    const playerBox = { x: player.x, y: player.y, w: player.w, h: player.h };
    if (overlap(playerBox, platform) && player.vy >= 0) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.canJump = true;
    }
  });
};

const collectCoins = () => {
  level.coins.forEach((coin) => {
    if (coin.collected) return;
    const dx = player.x + player.w / 2 - coin.x;
    const dy = player.y + player.h / 2 - coin.y;
    if (Math.hypot(dx, dy) < coin.r + player.w / 4) {
      coin.collected = true;
      const collectedCount = level.coins.filter((c) => c.collected).length;
      coinCountEl.textContent = collectedCount.toString();
    }
  });
};

const checkGoal = () => {
  if (gameState !== "playing") return;
  const playerBox = { x: player.x, y: player.y, w: player.w, h: player.h };
  if (overlap(playerBox, level.goal)) {
    gameState = "won";
    statusEl.textContent = "成功抵达旗杆！";
  }
};

const drawBackground = () => {
  ctx.fillStyle = "#9fd4ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#7abf6b";
  ctx.fillRect(0, level.groundY, canvas.width, canvas.height - level.groundY);
};

const drawPlatforms = () => {
  ctx.fillStyle = "#c97b3c";
  level.platforms.forEach((platform) => {
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  });
};

const drawCoins = () => {
  level.coins.forEach((coin) => {
    if (coin.collected) return;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
    ctx.fillStyle = "#f4d03f";
    ctx.fill();
    ctx.strokeStyle = "#d4ac0d";
    ctx.stroke();
  });
};

const drawGoal = () => {
  ctx.fillStyle = "#1d3557";
  ctx.fillRect(level.goal.x, level.goal.y, level.goal.w, level.goal.h);
  ctx.fillStyle = "#e63946";
  ctx.beginPath();
  ctx.moveTo(level.goal.x + level.goal.w, level.goal.y + 10);
  ctx.lineTo(level.goal.x + level.goal.w + 50, level.goal.y + 30);
  ctx.lineTo(level.goal.x + level.goal.w, level.goal.y + 50);
  ctx.closePath();
  ctx.fill();
};

const drawPlayer = () => {
  ctx.fillStyle = "#e63946";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = "#f1c27d";
  ctx.fillRect(player.x + 6, player.y + 8, player.w - 12, 14);
  ctx.fillStyle = "#1d3557";
  ctx.fillRect(player.x + 6, player.y + 26, player.w - 12, 14);
};

const draw = () => {
  drawBackground();
  drawPlatforms();
  drawCoins();
  drawGoal();
  drawPlayer();
};

const tick = () => {
  if (gameState === "playing") {
    updatePlayer();
    collectCoins();
    checkGoal();
  }
  draw();
  requestAnimationFrame(tick);
};

window.addEventListener("keydown", (event) => handleKey(event, true));
window.addEventListener("keyup", (event) => handleKey(event, false));
restartBtn.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(tick);
