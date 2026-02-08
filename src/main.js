const THREE = window.THREE;
if (!THREE) {
  const text = "Three.js failed to load. Please check network access and refresh.";
  window.addEventListener("DOMContentLoaded", () => {
    const panel = document.getElementById("statusPanel");
    const status = document.getElementById("statusText");
    if (panel) panel.style.display = "block";
    if (status) status.textContent = text;
  });
  throw new Error(text);
}

const app = document.getElementById("app");
const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const difficultyValue = document.getElementById("difficultyValue");
const levelValue = document.getElementById("levelValue");
const rewardValue = document.getElementById("rewardValue");
const speedValue = document.getElementById("speedValue");
const comboValue = document.getElementById("comboValue");
const boostValue = document.getElementById("boostValue");
const statusPanel = document.getElementById("statusPanel");
const statusText = document.getElementById("statusText");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const leftButton = document.getElementById("leftButton");
const rightButton = document.getElementById("rightButton");
const eventTicker = document.getElementById("eventTicker");

const STORAGE_KEY = "highway_escape_best";

function readBestScore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = Number(raw || "0");
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (_err) {
    return 0;
  }
}

function writeBestScore(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.floor(value)));
  } catch (_err) {
    // Ignore write failures in restricted environments.
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = createSkyTexture();
scene.fog = new THREE.Fog(0xa4b9cf, 90, 320);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 420);
camera.position.set(0, 6.6, 34);
camera.lookAt(0, 1.6, 2);

const hemi = new THREE.HemisphereLight(0xd8ebff, 0x3f4b34, 0.66);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff7dd, 1.15);
sun.position.set(-24, 34, -8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -52;
sun.shadow.camera.right = 52;
sun.shadow.camera.top = 52;
sun.shadow.camera.bottom = -52;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xbfd7ff, 0.28);
fill.position.set(18, 14, 20);
scene.add(fill);

const params = {
  laneWidth: 4.2,
  roadWidth: 15.2,
  roadLength: 520,
  spawnZ: -236,
  recycleZ: 104,
  playerZ: 26,
  playerHitWidth: 1.95,
  playerHitDepth: 4.05
};
const laneCenters = [-params.laneWidth, 0, params.laneWidth];
const LEVEL_TIME_MIN_SECONDS = 20;

function buildLevelGoal(level) {
  return {
    targetScore: 760 + (level - 1) * 260,
    targetRewards: Math.min(9, 3 + Math.floor((level - 1) / 2)),
    timeLimit: Math.max(LEVEL_TIME_MIN_SECONDS, 36 - (level - 1) * 1.4)
  };
}

const environment = buildEnvironment(scene, params, renderer);

const player = buildPlayerCar();
player.group.position.set(0, 0, params.playerZ);
scene.add(player.group);

const obstacleGroup = new THREE.Group();
scene.add(obstacleGroup);
const collectibleGroup = new THREE.Group();
scene.add(collectibleGroup);

const state = {
  running: false,
  paused: false,
  gameOver: false,
  score: 0,
  difficulty: 1,
  level: 1,
  laneIndex: 1,
  laneTargetX: laneCenters[1],
  worldSpeed: 30.5,
  speedKmh: 225,
  spawnTimer: 0,
  collectSpawnTimer: 0,
  startedAt: performance.now(),
  obstacles: [],
  collectibles: [],
  rewardsCollected: 0,
  comboCount: 0,
  comboTimer: 0,
  comboMultiplier: 1,
  boostTimer: 0,
  levelScoreStart: 0,
  levelRewardStart: 0,
  levelTargetScore: 760,
  levelTargetRewards: 3,
  levelTimeLimit: 36,
  levelTimeLeft: 36,
  eventEndsAt: 0,
  eventTone: "reward",
  bestScore: readBestScore()
};

let simulationTimeMs = performance.now();

function setStatus(message) {
  statusText.textContent = message;
}

function showStatus(show) {
  statusPanel.style.display = show ? "block" : "none";
}

function pushEvent(message, tone = "reward", durationSeconds = 1.45) {
  if (!eventTicker) return;
  eventTicker.textContent = message;
  state.eventTone = tone;
  state.eventEndsAt = simulationTimeMs + durationSeconds * 1000;
  eventTicker.className = "";
  eventTicker.classList.add("visible");
  if (tone) {
    eventTicker.classList.add(tone);
  }
}

function updateEventTicker() {
  if (!eventTicker) return;
  if (simulationTimeMs >= state.eventEndsAt) {
    eventTicker.className = "";
  }
}

function getLevelProgress() {
  return {
    score: Math.max(0, state.score - state.levelScoreStart),
    rewards: Math.max(0, state.rewardsCollected - state.levelRewardStart)
  };
}

function applyLevelGoal(level, announce = false) {
  const goal = buildLevelGoal(level);
  state.level = level;
  state.levelScoreStart = state.score;
  state.levelRewardStart = state.rewardsCollected;
  state.levelTargetScore = goal.targetScore;
  state.levelTargetRewards = goal.targetRewards;
  state.levelTimeLimit = goal.timeLimit;
  state.levelTimeLeft = goal.timeLimit;

  if (announce) {
    pushEvent(
      `Level ${state.level}: ${goal.targetScore} score + ${goal.targetRewards} rewards.`,
      "level",
      2.2
    );
  }
}

function updateHud() {
  const levelProgress = getLevelProgress();
  scoreValue.textContent = String(Math.floor(state.score));
  bestValue.textContent = String(Math.floor(state.bestScore));
  difficultyValue.textContent = `${state.difficulty.toFixed(1)}x`;
  if (levelValue) levelValue.textContent = `${state.level} (${Math.ceil(state.levelTimeLeft)}s)`;
  if (rewardValue) rewardValue.textContent = `${Math.floor(levelProgress.rewards)}/${state.levelTargetRewards}`;
  if (speedValue) speedValue.textContent = `${Math.round(state.speedKmh)} km/h`;
  if (comboValue) comboValue.textContent = `x${state.comboMultiplier.toFixed(1)}`;
  if (boostValue) boostValue.textContent = state.boostTimer > 0 ? `${state.boostTimer.toFixed(1)}s` : "READY";
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
}

function clampLaneIndex(index) {
  return Math.max(0, Math.min(laneCenters.length - 1, index));
}

function moveLane(delta) {
  if (!state.running || state.paused || state.gameOver) return;
  state.laneIndex = clampLaneIndex(state.laneIndex + delta);
  state.laneTargetX = laneCenters[state.laneIndex];
}

function clearObstacles() {
  for (const item of state.obstacles) {
    obstacleGroup.remove(item.mesh);
    disposeObject3D(item.mesh);
  }
  state.obstacles = [];
}

function clearCollectibles() {
  for (const item of state.collectibles) {
    collectibleGroup.remove(item.mesh);
    disposeObject3D(item.mesh);
  }
  state.collectibles = [];
}

function startGame() {
  state.running = true;
  state.paused = false;
  state.gameOver = false;
  state.score = 0;
  state.difficulty = 1;
  state.worldSpeed = 30.5;
  state.speedKmh = 225;
  state.spawnTimer = 0.12;
  state.collectSpawnTimer = 1.2;
  state.startedAt = simulationTimeMs;
  state.rewardsCollected = 0;
  state.comboCount = 0;
  state.comboTimer = 0;
  state.comboMultiplier = 1;
  state.boostTimer = 0;
  applyLevelGoal(1);
  state.eventEndsAt = 0;
  state.laneIndex = 1;
  state.laneTargetX = laneCenters[state.laneIndex];
  player.group.position.x = state.laneTargetX;
  player.group.position.y = 0;
  player.group.rotation.set(0, 0, 0);
  clearObstacles();
  clearCollectibles();
  showStatus(false);
  pushEvent(
    `Level 1 target: ${state.levelTargetScore} score + ${state.levelTargetRewards} rewards.`,
    "level",
    2.2
  );
  updateHud();
}

function endGame(reason = "crash") {
  state.running = false;
  state.paused = false;
  state.gameOver = true;
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    writeBestScore(state.bestScore);
  }
  if (reason === "timeout") {
    setStatus(`Time up on level ${state.level}. Final score ${Math.floor(state.score)}. Press Start to retry.`);
    pushEvent("Level timer expired. Run ended.", "danger", 1.9);
  } else {
    setStatus(`Crash detected. Final score ${Math.floor(state.score)}. Press Start to run again.`);
    pushEvent("Vehicle damaged. Run ended.", "level", 1.6);
  }
  showStatus(true);
  updateHud();
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  if (state.paused) {
    setStatus("Paused. Press Resume to continue.");
    showStatus(true);
    pushEvent("Simulation paused.", "level", 1.1);
  } else {
    showStatus(false);
    pushEvent("Simulation resumed.", "level", 1.1);
  }
  updateHud();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    app.requestFullscreen().catch(() => {
      // Ignore unsupported fullscreen requests.
    });
  } else {
    document.exitFullscreen().catch(() => {
      // Ignore exit failures on restricted platforms.
    });
  }
}

function spawnObstacle() {
  const lane = laneCenters[Math.floor(Math.random() * laneCenters.length)];
  const roll = Math.random();

  let obstacle;
  if (roll < 0.44) {
    obstacle = createBarrierObstacle();
  } else if (roll < 0.74) {
    obstacle = createConeClusterObstacle();
  } else {
    obstacle = createTrafficCarObstacle();
  }

  obstacle.mesh.position.x = lane;
  obstacle.mesh.position.z = params.spawnZ;
  obstacle.mesh.position.y = 0;
  obstacleGroup.add(obstacle.mesh);

  state.obstacles.push({
    ...obstacle,
    passed: false,
    pulseSeed: Math.random() * Math.PI * 2
  });
}

function spawnCollectible() {
  const lane = laneCenters[Math.floor(Math.random() * laneCenters.length)];
  const roll = Math.random();
  const collectible = roll < 0.26 ? createNitroReward() : createCoinReward();

  collectible.mesh.position.x = lane;
  collectible.mesh.position.z = params.spawnZ - 22 - Math.random() * 20;
  collectible.mesh.position.y = collectible.height;
  collectibleGroup.add(collectible.mesh);

  state.collectibles.push({
    ...collectible,
    lane,
    seed: Math.random() * Math.PI * 2
  });
}

function hasObstacleCollision(obstacle) {
  const dx = Math.abs(obstacle.mesh.position.x - player.group.position.x);
  if (dx > (obstacle.width + params.playerHitWidth) * 0.5) return false;

  const dz = Math.abs(obstacle.mesh.position.z - params.playerZ);
  return dz < (obstacle.depth + params.playerHitDepth) * 0.5;
}

function hasCollectiblePickup(collectible) {
  const dx = Math.abs(collectible.mesh.position.x - player.group.position.x);
  if (dx > (collectible.width + params.playerHitWidth) * 0.5) return false;

  const dz = Math.abs(collectible.mesh.position.z - params.playerZ);
  return dz < (collectible.depth + params.playerHitDepth) * 0.5;
}

function applyCollectibleReward(collectible) {
  state.rewardsCollected += 1;
  state.comboCount = state.comboTimer > 0 ? state.comboCount + 1 : 1;
  state.comboTimer = 4.2;
  state.comboMultiplier = Math.min(3.4, 1 + (state.comboCount - 1) * 0.22);

  const comboScore = collectible.baseScore * state.comboMultiplier;
  state.score += comboScore;

  if (collectible.type === "nitro") {
    state.boostTimer = Math.min(6.5, state.boostTimer + 2.4);
    pushEvent(`Nitro +2.4s  Combo x${state.comboMultiplier.toFixed(1)}`, "boost");
  } else {
    pushEvent(`Reward +${Math.round(comboScore)}  Combo x${state.comboMultiplier.toFixed(1)}`, "reward");
  }
}

function updateObstacles(dt, nowSeconds) {
  const spawnInterval = Math.max(0.34, 1.14 - state.difficulty * 0.08 - (state.level - 1) * 0.015);
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnObstacle();
    state.spawnTimer = spawnInterval;
  }

  for (let i = state.obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = state.obstacles[i];
    obstacle.mesh.position.z += state.worldSpeed * dt;

    if (obstacle.beacons) {
      for (let j = 0; j < obstacle.beacons.length; j += 1) {
        const pulse = 0.72 + 0.58 * Math.max(0, Math.sin(nowSeconds * 9 + obstacle.pulseSeed + j * 0.9));
        obstacle.beacons[j].material.emissiveIntensity = pulse;
      }
    }

    if (!obstacle.passed && obstacle.mesh.position.z > params.playerZ + 2.5) {
      obstacle.passed = true;
      state.score += 40 * state.difficulty;
    }

    if (hasObstacleCollision(obstacle)) {
      endGame();
      return;
    }

    if (obstacle.mesh.position.z > params.recycleZ) {
      obstacleGroup.remove(obstacle.mesh);
      disposeObject3D(obstacle.mesh);
      state.obstacles.splice(i, 1);
    }
  }
}

function updateCollectibles(dt, nowSeconds) {
  const spawnInterval = Math.max(0.78, 2.2 - state.level * 0.07);
  state.collectSpawnTimer -= dt;
  if (state.collectSpawnTimer <= 0) {
    spawnCollectible();
    state.collectSpawnTimer = spawnInterval + Math.random() * 0.35;
  }

  for (let i = state.collectibles.length - 1; i >= 0; i -= 1) {
    const collectible = state.collectibles[i];
    collectible.mesh.position.z += state.worldSpeed * dt;
    collectible.mesh.rotation.y += collectible.spinSpeed * dt;
    collectible.mesh.position.y = collectible.height + Math.sin(nowSeconds * 4 + collectible.seed) * 0.08;

    if (collectible.glow) {
      collectible.glow.material.emissiveIntensity =
        collectible.glowBase + Math.sin(nowSeconds * 8 + collectible.seed) * 0.34;
    }

    if (hasCollectiblePickup(collectible)) {
      applyCollectibleReward(collectible);
      collectibleGroup.remove(collectible.mesh);
      disposeObject3D(collectible.mesh);
      state.collectibles.splice(i, 1);
      continue;
    }

    if (collectible.mesh.position.z > params.recycleZ + 3) {
      collectibleGroup.remove(collectible.mesh);
      disposeObject3D(collectible.mesh);
      state.collectibles.splice(i, 1);
    }
  }
}

function updatePlayer(dt, nowMs) {
  const laneBlend = Math.min(1, dt * 9.2);
  const deltaX = state.laneTargetX - player.group.position.x;
  player.group.position.x += deltaX * laneBlend;

  const rollTarget = -deltaX * 0.085;
  player.group.rotation.z += (rollTarget - player.group.rotation.z) * Math.min(1, dt * 10.5);

  const pitchTarget = -0.014 + Math.sin(nowMs * 0.0046) * 0.006;
  player.group.rotation.x += (pitchTarget - player.group.rotation.x) * Math.min(1, dt * 6.5);

  const bounce = state.running && !state.paused && !state.gameOver ? Math.sin(nowMs * 0.012) * 0.04 : 0;
  player.group.position.y = bounce;

  const activeRun = state.running && !state.paused && !state.gameOver;
  const wheelSpin = activeRun ? state.worldSpeed * dt * 2.1 : 0;
  for (const wheel of player.wheels) {
    wheel.rotation.x -= wheelSpin;
  }

  const boost = activeRun ? (state.boostTimer > 0 ? 1.28 : 0.95) : 0.55;
  for (const lamp of player.headlights) {
    lamp.material.emissiveIntensity = boost;
  }
}

function updateEnvironment(dt, nowSeconds) {
  const dashRange = params.roadLength;
  for (const dash of environment.dashes) {
    dash.position.z += state.worldSpeed * dt * 1.08;
    if (dash.position.z > dashRange * 0.5) {
      dash.position.z -= dashRange;
    }
  }

  for (const marker of environment.markers) {
    marker.position.z += state.worldSpeed * dt;
    if (marker.position.z > params.recycleZ + 18) {
      marker.position.z -= params.roadLength;
    }
  }

  for (const lamp of environment.lamps) {
    lamp.group.position.z += state.worldSpeed * dt * 0.96;
    if (lamp.group.position.z > params.recycleZ + 26) {
      lamp.group.position.z -= params.roadLength;
    }
    lamp.bulb.material.emissiveIntensity = 0.6 + Math.sin(nowSeconds * 1.1 + lamp.phase) * 0.05;
  }

  if (environment.guardrails) {
    for (const rail of environment.guardrails) {
      rail.position.z += state.worldSpeed * dt;
      if (rail.position.z > params.recycleZ + 18) {
        rail.position.z -= params.roadLength;
      }
    }
  }

  if (environment.signboards) {
    for (const sign of environment.signboards) {
      sign.position.z += state.worldSpeed * dt * 0.98;
      if (sign.position.z > params.recycleZ + 20) {
        sign.position.z -= params.roadLength;
      }
    }
  }

  if (environment.roadTexture) {
    environment.roadTexture.offset.y -= (state.worldSpeed * dt) / 220;
  }

  if (environment.roadSheenTexture) {
    environment.roadSheenTexture.offset.y -= (state.worldSpeed * dt) / 360;
  }
}

function updateWorld(dt, elapsed, nowSeconds) {
  state.levelTimeLeft = Math.max(0, state.levelTimeLeft - dt);
  const levelTimeUse = 1 - state.levelTimeLeft / Math.max(1, state.levelTimeLimit);

  state.difficulty = 1 + elapsed * 0.04 + (state.level - 1) * 0.18 + levelTimeUse * 0.22;
  if (state.comboTimer > 0) {
    state.comboTimer = Math.max(0, state.comboTimer - dt);
  } else if (state.comboMultiplier !== 1 || state.comboCount !== 0) {
    state.comboMultiplier = 1;
    state.comboCount = 0;
  }

  state.boostTimer = Math.max(0, state.boostTimer - dt);
  const boostFactor = state.boostTimer > 0 ? 1.3 : 1;
  const baseSpeed = 25 + state.difficulty * 5.3;
  state.worldSpeed = baseSpeed * boostFactor;
  state.speedKmh = state.worldSpeed * 7.35;

  const scoreRate = 11.8 * state.difficulty * state.comboMultiplier * (state.boostTimer > 0 ? 1.25 : 1);
  state.score += dt * scoreRate;

  updateEnvironment(dt, nowSeconds);
  updateObstacles(dt, nowSeconds);
  if (!state.gameOver) {
    updateCollectibles(dt, nowSeconds);
  }

  if (state.gameOver) {
    updateEventTicker();
    return;
  }

  const levelProgress = getLevelProgress();
  if (levelProgress.score >= state.levelTargetScore && levelProgress.rewards >= state.levelTargetRewards) {
    const clearedLevel = state.level;
    const levelBonus = 140 + clearedLevel * 45 + Math.round(state.levelTimeLeft * 8);
    state.score += levelBonus;
    applyLevelGoal(clearedLevel + 1);
    pushEvent(
      `Level ${clearedLevel} clear +${levelBonus}. Level ${state.level} objectives online.`,
      "level",
      2.2
    );
  }

  if (state.levelTimeLeft <= 0) {
    endGame("timeout");
    return;
  }

  updateEventTicker();
}

if (startButton) startButton.addEventListener("click", startGame);
if (pauseButton) pauseButton.addEventListener("click", togglePause);
if (leftButton) leftButton.addEventListener("click", () => moveLane(-1));
if (rightButton) rightButton.addEventListener("click", () => moveLane(1));

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    event.preventDefault();
    moveLane(-1);
  }
  if (event.code === "ArrowRight" || event.code === "KeyD") {
    event.preventDefault();
    moveLane(1);
  }
  if (event.code === "KeyP") {
    event.preventDefault();
    togglePause();
  }
  if (event.code === "KeyF") {
    event.preventDefault();
    toggleFullscreen();
  }
  if (event.code === "Enter" && (!state.running || state.gameOver)) {
    event.preventDefault();
    startGame();
  }
});

let touchStartX = 0;
let touchStartY = 0;
window.addEventListener(
  "touchstart",
  (event) => {
    const t = event.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  },
  { passive: true }
);

window.addEventListener(
  "touchend",
  (event) => {
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy)) {
      moveLane(dx > 0 ? 1 : -1);
    }
  },
  { passive: true }
);

function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  if (w < 760) {
    camera.position.set(0, 7.3, 37);
    camera.lookAt(0, 1.8, 4);
  } else {
    camera.position.set(0, 6.6, 34);
    camera.lookAt(0, 1.6, 2);
  }
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener("resize", handleResize);
document.addEventListener("fullscreenchange", handleResize);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.running && !state.paused && !state.gameOver) {
    togglePause();
  }
});

let lastTime = performance.now();
function stepSimulation(dt) {
  simulationTimeMs += dt * 1000;
  const nowMs = simulationTimeMs;
  const nowSeconds = nowMs / 1000;

  if (state.running && !state.paused && !state.gameOver) {
    const elapsed = (nowMs - state.startedAt) / 1000;
    updatePlayer(dt, nowMs);
    updateWorld(dt, elapsed, nowSeconds);
    updateHud();
  } else if (!state.running && !state.gameOver) {
    updatePlayer(dt, nowMs);
    updateEnvironment(dt * 0.2, nowSeconds);
    updateEventTicker();
  } else {
    updatePlayer(dt, nowMs);
    updateEventTicker();
  }
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  stepSimulation(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.advanceTime = (ms) => {
  const totalSteps = Math.max(1, Math.round(ms / (1000 / 60)));
  const dt = (ms / 1000) / totalSteps;
  for (let i = 0; i < totalSteps; i += 1) {
    stepSimulation(dt);
  }
  renderer.render(scene, camera);
};

function roundNumber(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function renderGameToText() {
  const mode = state.gameOver ? "game_over" : state.running ? (state.paused ? "paused" : "running") : "ready";
  const levelProgress = getLevelProgress();
  const sortedObstacles = [...state.obstacles].sort((a, b) => b.mesh.position.z - a.mesh.position.z).slice(0, 12);
  const sortedRewards = [...state.collectibles].sort((a, b) => b.mesh.position.z - a.mesh.position.z).slice(0, 10);

  const payload = {
    coordinateSystem: "x left(-)/right(+), z far(-)->near(+ toward player), y up(+)",
    mode,
    player: {
      laneIndex: state.laneIndex,
      x: roundNumber(player.group.position.x),
      y: roundNumber(player.group.position.y),
      z: params.playerZ,
      laneTargetX: roundNumber(state.laneTargetX)
    },
    stats: {
      score: Math.floor(state.score),
      best: Math.floor(state.bestScore),
      difficulty: roundNumber(state.difficulty, 2),
      level: state.level,
      speedKmh: Math.round(state.speedKmh),
      rewardsCollected: state.rewardsCollected,
      comboMultiplier: roundNumber(state.comboMultiplier, 2),
      boostSeconds: roundNumber(Math.max(0, state.boostTimer), 2),
      levelGoalScore: state.levelTargetScore,
      levelGoalRewards: state.levelTargetRewards,
      levelScoreProgress: Math.floor(levelProgress.score),
      levelRewardProgress: Math.floor(levelProgress.rewards),
      levelTimeLeft: roundNumber(Math.max(0, state.levelTimeLeft), 2),
      levelTimeLimit: roundNumber(state.levelTimeLimit, 2)
    },
    obstacles: sortedObstacles.map((item) => ({
      type: item.type || "obstacle",
      x: roundNumber(item.mesh.position.x),
      z: roundNumber(item.mesh.position.z),
      width: roundNumber(item.width),
      depth: roundNumber(item.depth)
    })),
    rewards: sortedRewards.map((item) => ({
      type: item.type,
      x: roundNumber(item.mesh.position.x),
      z: roundNumber(item.mesh.position.z),
      width: roundNumber(item.width),
      depth: roundNumber(item.depth)
    }))
  };

  return JSON.stringify(payload);
}

window.render_game_to_text = renderGameToText;

updateHud();
setStatus("Press Start. Clear each level goal before timer expires.");

function disposeObject3D(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    if (child.geometry) child.geometry.dispose();
    if (Array.isArray(child.material)) {
      for (const mat of child.material) mat.dispose();
    } else if (child.material) {
      child.material.dispose();
    }
  });
}

function createSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0.0, "#8dc5ff");
  gradient.addColorStop(0.32, "#d5ecff");
  gradient.addColorStop(0.56, "#ffe6be");
  gradient.addColorStop(0.76, "#7996b2");
  gradient.addColorStop(1.0, "#1a2a3d");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 14; i += 1) {
    const y = 220 + i * 32;
    ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#ddeeff";
    ctx.fillRect(0, y, canvas.width, 12);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createAsphaltTexture(rendererRef) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#2e3237";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 8000; i += 1) {
    const tone = 34 + Math.floor(Math.random() * 45);
    ctx.fillStyle = `rgba(${tone}, ${tone}, ${tone}, 0.14)`;
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const s = Math.random() * 2.2;
    ctx.fillRect(x, y, s, s);
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 18; i += 1) {
    const x1 = Math.random() * canvas.width;
    const x2 = x1 + (Math.random() - 0.5) * 120;
    const y1 = Math.random() * canvas.height;
    const y2 = y1 + Math.random() * 140;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 10);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, rendererRef.capabilities.getMaxAnisotropy());
  return texture;
}

function createRoadSheenTexture(rendererRef) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0.0, "rgba(190, 211, 236, 0.22)");
  gradient.addColorStop(0.18, "rgba(190, 211, 236, 0.08)");
  gradient.addColorStop(0.54, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(1.0, "rgba(110, 146, 179, 0.14)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 90; i += 1) {
    const alpha = 0.03 + Math.random() * 0.05;
    const width = 8 + Math.random() * 22;
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(x, y, width, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, rendererRef.capabilities.getMaxAnisotropy());
  return texture;
}

function buildEnvironment(sceneRef, config, rendererRef) {
  const dashes = [];
  const markers = [];
  const lamps = [];
  const guardrails = [];
  const signboards = [];

  const world = new THREE.Group();
  sceneRef.add(world);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 640),
    new THREE.MeshStandardMaterial({ color: 0x5d7053, roughness: 1.0, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  world.add(ground);

  const roadTexture = createAsphaltTexture(rendererRef);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(config.roadWidth, config.roadLength),
    new THREE.MeshStandardMaterial({ map: roadTexture, color: 0x31353b, roughness: 0.95, metalness: 0.05 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  world.add(road);

  const roadSheenTexture = createRoadSheenTexture(rendererRef);
  const roadSheen = new THREE.Mesh(
    new THREE.PlaneGeometry(config.roadWidth * 0.94, config.roadLength),
    new THREE.MeshStandardMaterial({
      map: roadSheenTexture,
      color: 0xa8bdd5,
      roughness: 0.12,
      metalness: 0.08,
      transparent: true,
      opacity: 0.12
    })
  );
  roadSheen.rotation.x = -Math.PI / 2;
  roadSheen.position.y = 0.023;
  roadSheen.receiveShadow = true;
  world.add(roadSheen);

  const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x6d6f73, roughness: 0.86, metalness: 0.08 });
  const shoulderWidth = 1.4;
  const shoulderOffset = config.roadWidth * 0.5 + shoulderWidth * 0.5;

  const leftShoulder = new THREE.Mesh(new THREE.PlaneGeometry(shoulderWidth, config.roadLength), shoulderMat);
  leftShoulder.rotation.x = -Math.PI / 2;
  leftShoulder.position.set(-shoulderOffset, 0.012, 0);
  leftShoulder.receiveShadow = true;
  world.add(leftShoulder);

  const rightShoulder = leftShoulder.clone();
  rightShoulder.position.x = shoulderOffset;
  world.add(rightShoulder);

  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf5f1de, roughness: 0.44, metalness: 0.08 });
  const dividerX = [-config.laneWidth * 0.5, config.laneWidth * 0.5];
  const dashSpacing = 9.3;
  const dashLength = 4.1;

  for (const x of dividerX) {
    for (let z = -config.roadLength * 0.5; z < config.roadLength * 0.5; z += dashSpacing) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, dashLength), dashMat);
      dash.position.set(x, 0.03, z);
      dash.receiveShadow = true;
      world.add(dash);
      dashes.push(dash);
    }
  }

  const edgeStripMat = new THREE.MeshStandardMaterial({ color: 0xf8f4e6, roughness: 0.4, metalness: 0.1 });
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, config.roadLength), edgeStripMat);
    edge.position.set(side * (config.roadWidth * 0.5 - 0.08), 0.03, 0);
    edge.receiveShadow = true;
    world.add(edge);
  }

  const railMat = new THREE.MeshStandardMaterial({ color: 0xbec7d1, roughness: 0.54, metalness: 0.42 });
  const railPostMat = new THREE.MeshStandardMaterial({ color: 0x7b8188, roughness: 0.72, metalness: 0.22 });
  for (let z = -config.roadLength * 0.5; z < config.roadLength * 0.5; z += 12) {
    for (const side of [-1, 1]) {
      const rail = new THREE.Group();
      const railX = side * (config.roadWidth * 0.5 + 2.1);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 0.2), railMat);
      beam.position.y = 0.8;
      beam.castShadow = true;
      rail.add(beam);

      for (const postOffset of [-1.35, 1.35]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.86, 0.14), railPostMat);
        post.position.set(postOffset, 0.43, 0);
        post.castShadow = true;
        rail.add(post);
      }

      rail.position.set(railX, 0, z);
      world.add(rail);
      guardrails.push(rail);
    }
  }

  for (let z = -config.roadLength * 0.5; z < config.roadLength * 0.5; z += 8.4) {
    for (const side of [-1, 1]) {
      const marker = new THREE.Group();

      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.62, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xd7dce2, roughness: 0.82, metalness: 0.08 })
      );
      post.position.y = 0.31;
      post.castShadow = true;
      marker.add(post);

      const reflector = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.2, 0.09),
        new THREE.MeshStandardMaterial({ color: 0xff644f, emissive: 0x66180f, emissiveIntensity: 0.35 })
      );
      reflector.position.set(0, 0.46, side === -1 ? 0.03 : -0.03);
      marker.add(reflector);

      marker.position.set(side * (config.roadWidth * 0.5 + 1.16), 0, z);
      world.add(marker);
      markers.push(marker);
    }
  }

  for (let z = -config.roadLength * 0.5; z < config.roadLength * 0.5; z += 34) {
    for (const side of [-1, 1]) {
      const group = new THREE.Group();
      const x = side * (config.roadWidth * 0.5 + 3.1);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.12, 6.4, 12),
        new THREE.MeshStandardMaterial({ color: 0x5e636a, roughness: 0.78, metalness: 0.24 })
      );
      pole.position.y = 3.2;
      pole.castShadow = true;
      group.add(pole);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.12, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x676c73, roughness: 0.7, metalness: 0.22 })
      );
      arm.position.set(-side * 0.66, 6.1, 0);
      arm.castShadow = true;
      group.add(arm);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xffefca, emissive: 0xffd18a, emissiveIntensity: 0.62 })
      );
      bulb.position.set(-side * 1.26, 5.94, 0);
      group.add(bulb);

      group.position.set(x, 0, z);
      world.add(group);
      lamps.push({ group, bulb, phase: Math.random() * Math.PI * 2 });
    }
  }

  for (let z = -config.roadLength * 0.5 + 20; z < config.roadLength * 0.5; z += 68) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const sign = new THREE.Group();
    const signX = side * (config.roadWidth * 0.5 + 4.3);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.11, 2.8, 12),
      new THREE.MeshStandardMaterial({ color: 0x67707a, roughness: 0.74, metalness: 0.3 })
    );
    pole.position.y = 1.4;
    pole.castShadow = true;
    sign.add(pole);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.84, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x2d5b88, roughness: 0.44, metalness: 0.32 })
    );
    board.position.y = 2.24;
    board.castShadow = true;
    sign.add(board);

    const line = new THREE.Mesh(
      new THREE.BoxGeometry(1.34, 0.07, 0.09),
      new THREE.MeshStandardMaterial({ color: 0xd7ecff, roughness: 0.3, metalness: 0.12 })
    );
    line.position.y = 2.24;
    sign.add(line);

    sign.position.set(signX, 0, z);
    world.add(sign);
    signboards.push(sign);
  }

  const mountainMat = new THREE.MeshStandardMaterial({ color: 0x70829a, roughness: 0.95, metalness: 0.02 });
  for (let i = 0; i < 18; i += 1) {
    const radius = 9 + Math.random() * 12;
    const height = 14 + Math.random() * 24;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 8), mountainMat);
    const side = Math.random() < 0.5 ? -1 : 1;
    mountain.position.set(side * (34 + Math.random() * 54), height * 0.5 - 1, -250 + Math.random() * 390);
    mountain.castShadow = true;
    mountain.receiveShadow = true;
    world.add(mountain);
  }

  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x607085, roughness: 0.92, metalness: 0.05 });
  for (let i = 0; i < 32; i += 1) {
    const w = 4 + Math.random() * 5;
    const h = 8 + Math.random() * 26;
    const d = 4 + Math.random() * 8;
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skylineMat);
    const side = Math.random() < 0.5 ? -1 : 1;
    block.position.set(side * (52 + Math.random() * 64), h * 0.5 - 1.4, -280 + Math.random() * 460);
    block.receiveShadow = true;
    world.add(block);
  }

  const sunDisk = new THREE.Mesh(
    new THREE.SphereGeometry(16, 22, 16),
    new THREE.MeshBasicMaterial({ color: 0xffcf8e })
  );
  sunDisk.position.set(0, 92, -250);
  sceneRef.add(sunDisk);

  return { world, dashes, markers, lamps, guardrails, signboards, roadTexture, roadSheenTexture };
}

function buildPlayerCar() {
  const group = new THREE.Group();
  const wheels = [];
  const headlights = [];

  const paint = new THREE.MeshStandardMaterial({ color: 0x2f6fcf, roughness: 0.3, metalness: 0.56 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x1d232e, roughness: 0.58, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xb9d6f1,
    roughness: 0.08,
    metalness: 0.08,
    transparent: true,
    opacity: 0.86
  });

  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.62, 4.65), paint);
  lowerBody.position.y = 0.58;
  lowerBody.castShadow = true;
  group.add(lowerBody);

  const frontCurve = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 16), paint);
  frontCurve.scale.set(1.08, 0.56, 0.8);
  frontCurve.position.set(0, 0.66, -2.04);
  frontCurve.castShadow = true;
  group.add(frontCurve);

  const rearCurve = new THREE.Mesh(new THREE.SphereGeometry(0.88, 18, 14), paint);
  rearCurve.scale.set(1.05, 0.54, 0.74);
  rearCurve.position.set(0, 0.66, 2.06);
  rearCurve.castShadow = true;
  group.add(rearCurve);

  const roof = new THREE.Mesh(new THREE.CapsuleGeometry(0.67, 1.56, 8, 16), paint);
  roof.rotation.x = Math.PI / 2;
  roof.position.set(0, 1.08, -0.16);
  roof.castShadow = true;
  group.add(roof);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.52, 0.08), glass);
  windshield.position.set(0, 1.19, -1.02);
  windshield.rotation.x = -0.5;
  group.add(windshield);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 0.08), glass);
  rearWindow.position.set(0, 1.12, 0.87);
  rearWindow.rotation.x = 0.42;
  group.add(rearWindow);

  for (const side of [-1, 1]) {
    const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 1.74), glass);
    sideWindow.position.set(side * 0.74, 1.11, -0.06);
    group.add(sideWindow);

    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.2), trim);
    mirror.position.set(side * 1.03, 1.02, -1.15);
    mirror.castShadow = true;
    group.add(mirror);
  }

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x131416, roughness: 0.86, metalness: 0.18 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x9da6b3, roughness: 0.34, metalness: 0.62 });
  const wheelPositions = [
    [-0.98, 0.4, -1.37],
    [0.98, 0.4, -1.37],
    [-0.98, 0.4, 1.37],
    [0.98, 0.4, 1.37]
  ];

  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Group();

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.38, 24), wheelMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheel.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.4, 16), rimMat);
    rim.rotation.z = Math.PI / 2;
    wheel.add(rim);

    wheel.position.set(x, y, z);
    group.add(wheel);
    wheels.push(wheel);
  }

  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.28, 0.09), trim);
  grille.position.set(0, 0.7, -2.31);
  grille.castShadow = true;
  group.add(grille);

  for (const side of [-1, 1]) {
    const headlight = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.16, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xfff2d4, emissive: 0xffe4a8, emissiveIntensity: 0.95 })
    );
    headlight.position.set(side * 0.73, 0.86, -2.29);
    group.add(headlight);
    headlights.push(headlight);

    const tailLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.14, 0.07),
      new THREE.MeshStandardMaterial({ color: 0xff7362, emissive: 0xff2a22, emissiveIntensity: 0.65 })
    );
    tailLight.position.set(side * 0.75, 0.86, 2.33);
    group.add(tailLight);
  }

  const underShadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.52, 30),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
  );
  underShadow.rotation.x = -Math.PI / 2;
  underShadow.position.y = 0.03;
  underShadow.scale.set(1.0, 1.85, 1);
  group.add(underShadow);

  return { group, wheels, headlights };
}

function createCoinReward() {
  const mesh = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xf3c765,
    roughness: 0.3,
    metalness: 0.72,
    emissive: 0x835a17,
    emissiveIntensity: 0.58
  });
  const centerMat = new THREE.MeshStandardMaterial({
    color: 0xffe2a4,
    roughness: 0.24,
    metalness: 0.64,
    emissive: 0x8c631c,
    emissiveIntensity: 0.48
  });

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.11, 18, 30), ringMat);
  ring.rotation.y = Math.PI / 2;
  mesh.add(ring);

  const center = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 24), centerMat);
  center.rotation.z = Math.PI / 2;
  mesh.add(center);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 14, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffcf7a,
      roughness: 0.6,
      metalness: 0.04,
      emissive: 0xffb04e,
      emissiveIntensity: 0.68,
      transparent: true,
      opacity: 0.26
    })
  );
  mesh.add(glow);

  return {
    type: "coin",
    mesh,
    width: 1.02,
    depth: 1.02,
    height: 0.95,
    baseScore: 70,
    spinSpeed: 2.8,
    glow,
    glowBase: 0.68
  };
}

function createNitroReward() {
  const mesh = new THREE.Group();
  const canMat = new THREE.MeshStandardMaterial({
    color: 0x87dcff,
    roughness: 0.24,
    metalness: 0.62,
    emissive: 0x1d4f6d,
    emissiveIntensity: 0.62
  });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xcde8ff, roughness: 0.22, metalness: 0.76 });

  const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.84, 20), canMat);
  canister.castShadow = true;
  mesh.add(canister);

  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 18), capMat);
  capTop.position.y = 0.49;
  mesh.add(capTop);

  const capBottom = capTop.clone();
  capBottom.position.y = -0.49;
  mesh.add(capBottom);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 14, 10),
    new THREE.MeshStandardMaterial({
      color: 0x9cefff,
      roughness: 0.54,
      metalness: 0.04,
      emissive: 0x57d8ff,
      emissiveIntensity: 0.82,
      transparent: true,
      opacity: 0.24
    })
  );
  mesh.add(glow);

  return {
    type: "nitro",
    mesh,
    width: 0.9,
    depth: 0.9,
    height: 1.06,
    baseScore: 110,
    spinSpeed: 2.3,
    glow,
    glowBase: 0.82
  };
}

function createBarrierObstacle() {
  const mesh = new THREE.Group();
  const beacons = [];

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.25, 0.7, 1.12),
    new THREE.MeshStandardMaterial({ color: 0xf07939, roughness: 0.52, metalness: 0.08 })
  );
  base.position.y = 0.35;
  base.castShadow = true;
  base.receiveShadow = true;
  mesh.add(base);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(2.34, 0.2, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xff8d48, roughness: 0.47, metalness: 0.12 })
  );
  top.position.y = 0.82;
  top.castShadow = true;
  mesh.add(top);

  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.42, metalness: 0.08 });
  for (let i = -1; i <= 1; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.04), stripeMat);
    stripe.position.set(i * 0.72, 0.57, 0.57);
    stripe.rotation.z = i === 0 ? 0.35 : -0.35;
    mesh.add(stripe);
  }

  for (const side of [-1, 1]) {
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xff6d60, emissive: 0xff3d2d, emissiveIntensity: 0.8 })
    );
    beacon.position.set(side * 1.0, 0.96, 0);
    mesh.add(beacon);
    beacons.push(beacon);
  }

  return {
    type: "barrier",
    mesh,
    width: 2.3,
    depth: 1.16,
    beacons
  };
}

function createConeClusterObstacle() {
  const mesh = new THREE.Group();
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff8b2d, roughness: 0.5, metalness: 0.05 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.34, metalness: 0.02 });

  const positions = [-0.7, 0, 0.7];
  for (const x of positions) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.34, 0.92, 16), coneMat);
    cone.position.set(x, 0.46, 0);
    cone.castShadow = true;
    cone.receiveShadow = true;
    mesh.add(cone);

    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.04, 8, 16), stripeMat);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.set(x, 0.5, 0);
    mesh.add(stripe);
  }

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.02, 0.06, 0.92),
    new THREE.MeshStandardMaterial({ color: 0x34373d, roughness: 0.9, metalness: 0.1 })
  );
  base.position.y = 0.03;
  base.receiveShadow = true;
  mesh.add(base);

  return {
    type: "cones",
    mesh,
    width: 2.06,
    depth: 1.04
  };
}

function createTrafficCarObstacle() {
  const colors = [0xb8c1cf, 0x3f4c5d, 0xb64940, 0x8f9198, 0x2464a6, 0x556d3a];
  const color = colors[Math.floor(Math.random() * colors.length)];

  const mesh = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1f25, roughness: 0.58, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xaec4d8,
    roughness: 0.08,
    metalness: 0.08,
    transparent: true,
    opacity: 0.82
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.58, 4.0), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  body.receiveShadow = true;
  mesh.add(body);

  const roof = new THREE.Mesh(new THREE.CapsuleGeometry(0.56, 1.2, 8, 14), paint);
  roof.rotation.x = Math.PI / 2;
  roof.position.set(0, 0.96, -0.08);
  roof.castShadow = true;
  mesh.add(roof);

  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.44, 0.07), glass);
  wind.position.set(0, 1.06, -0.85);
  wind.rotation.x = -0.48;
  mesh.add(wind);

  const rearWind = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.36, 0.07), glass);
  rearWind.position.set(0, 1.0, 0.68);
  rearWind.rotation.x = 0.4;
  mesh.add(rearWind);

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.88, metalness: 0.15 });
  const wheelPos = [
    [-0.9, 0.37, -1.2],
    [0.9, 0.37, -1.2],
    [-0.9, 0.37, 1.2],
    [0.9, 0.37, 1.2]
  ];

  for (const [x, y, z] of wheelPos) {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.34, 20), wheelMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(x, y, z);
    tire.castShadow = true;
    mesh.add(tire);
  }

  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.12, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xff7c6d, emissive: 0xff3f33, emissiveIntensity: 0.58 })
    );
    tail.position.set(side * 0.66, 0.82, 2.04);
    mesh.add(tail);
  }

  const frontGrille = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.2, 0.08), dark);
  frontGrille.position.set(0, 0.68, -2.01);
  frontGrille.castShadow = true;
  mesh.add(frontGrille);

  return {
    type: "traffic_car",
    mesh,
    width: 1.94,
    depth: 4.06
  };
}
