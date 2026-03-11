const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const hpEl = document.getElementById("hp");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("startButton");

const stickArea = document.getElementById("stickArea");
const stickKnob = document.getElementById("stickKnob");
const fireButton = document.getElementById("fireButton");

const state = {
  running: false,
  score: 0,
  hp: 5,
  level: 1,
  time: 0,
  lastFrame: 0,
  joystick: { x: 0, y: 0, activeId: null },
  firing: false,
  fireCooldown: 0,
  enemyCooldown: 0,
  player: {
    x: 0,
    y: 0,
    size: 16,
    speed: 320,
  },
  bullets: [],
  enemies: [],
};

function resetGame() {
  state.score = 0;
  state.hp = 5;
  state.level = 1;
  state.time = 0;
  state.fireCooldown = 0;
  state.enemyCooldown = 0;
  state.bullets = [];
  state.enemies = [];
  state.player.x = canvas.width * 0.14;
  state.player.y = canvas.height * 0.5;
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  hpEl.textContent = String(state.hp);
  levelEl.textContent = String(state.level);
}

function spawnEnemy() {
  const size = 12 + Math.random() * 18;
  const speed = 80 + Math.random() * 120 + state.level * 18;
  const y = Math.random() * (canvas.height - size * 2) + size;
  state.enemies.push({
    x: canvas.width + size,
    y,
    vx: -speed,
    size,
    hp: 1 + Math.floor(state.level / 4),
  });
}

function shoot() {
  state.bullets.push({
    x: state.player.x + state.player.size + 5,
    y: state.player.y,
    vx: 540,
    size: 4,
  });
}

function update(delta) {
  if (!state.running) return;

  state.time += delta;
  state.level = 1 + Math.floor(state.time / 20);

  const moveStrength = Math.hypot(state.joystick.x, state.joystick.y);
  if (moveStrength > 0.01) {
    const normalizedX = state.joystick.x / moveStrength;
    const normalizedY = state.joystick.y / moveStrength;
    state.player.x += normalizedX * state.player.speed * delta;
    state.player.y += normalizedY * state.player.speed * delta;
  }

  state.player.x = Math.max(state.player.size, Math.min(canvas.width - state.player.size, state.player.x));
  state.player.y = Math.max(state.player.size, Math.min(canvas.height - state.player.size, state.player.y));

  state.fireCooldown -= delta;
  if (state.firing && state.fireCooldown <= 0) {
    shoot();
    state.fireCooldown = 0.14;
  }

  state.enemyCooldown -= delta;
  if (state.enemyCooldown <= 0) {
    spawnEnemy();
    state.enemyCooldown = Math.max(0.25, 1.1 - state.level * 0.07);
  }

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * delta;
  }
  for (const enemy of state.enemies) {
    enemy.x += enemy.vx * delta;
  }

  for (const enemy of state.enemies) {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    if (Math.hypot(dx, dy) < enemy.size + state.player.size * 0.8) {
      state.hp -= 1;
      enemy.x = -100;
      if (state.hp <= 0) {
        state.running = false;
        overlay.classList.remove("hidden");
        startButton.textContent = "リトライ";
      }
    }
    for (const bullet of state.bullets) {
      const bx = enemy.x - bullet.x;
      const by = enemy.y - bullet.y;
      if (Math.hypot(bx, by) < enemy.size + bullet.size) {
        enemy.hp -= 1;
        bullet.x = canvas.width + 999;
        if (enemy.hp <= 0) {
          enemy.x = -200;
          state.score += 10;
        }
      }
    }
  }

  state.bullets = state.bullets.filter((b) => b.x < canvas.width + 50);
  state.enemies = state.enemies.filter((e) => e.x > -50 && e.hp > 0);

  updateHud();
}

function drawStarField() {
  for (let i = 0; i < 80; i++) {
    const x = (i * 89 + state.time * (20 + (i % 5) * 15)) % canvas.width;
    const y = (i * 53) % canvas.height;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + (i % 4) * 0.2})`;
    ctx.fillRect(canvas.width - x, y, 2, 2);
  }
}

function drawShip() {
  const { x, y, size } = state.player;
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = "#4ff3ff";
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.7, size * 0.8);
  ctx.lineTo(-size * 0.7, -size * 0.8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#b3f9ff";
  ctx.beginPath();
  ctx.arc(-size * 0.1, 0, size * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStarField();
  drawShip();

  for (const bullet of state.bullets) {
    ctx.fillStyle = "#ffec7f";
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of state.enemies) {
    ctx.fillStyle = "#ff5f7a";
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(enemy.x - enemy.size, enemy.y + enemy.size + 4, enemy.size * 2, 3);
    ctx.fillStyle = "#7dff8c";
    ctx.fillRect(enemy.x - enemy.size, enemy.y + enemy.size + 4, (enemy.hp / (1 + Math.floor(state.level / 4))) * enemy.size * 2, 3);
  }
}

function gameLoop(timestamp) {
  const delta = Math.min(0.033, (timestamp - state.lastFrame) / 1000 || 0);
  state.lastFrame = timestamp;
  update(delta);
  render();
  requestAnimationFrame(gameLoop);
}

function setJoystick(clientX, clientY) {
  const rect = stickArea.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const maxRadius = rect.width * 0.34;
  const length = Math.hypot(dx, dy);
  const scale = length > maxRadius ? maxRadius / length : 1;
  const clampedX = dx * scale;
  const clampedY = dy * scale;

  state.joystick.x = clampedX / maxRadius;
  state.joystick.y = clampedY / maxRadius;

  stickKnob.style.left = `${50 + (clampedX / rect.width) * 100 - 21}%`;
  stickKnob.style.top = `${50 + (clampedY / rect.height) * 100 - 21}%`;
}

function resetJoystick() {
  state.joystick.x = 0;
  state.joystick.y = 0;
  stickKnob.style.left = "29%";
  stickKnob.style.top = "29%";
}

stickArea.addEventListener("pointerdown", (e) => {
  state.joystick.activeId = e.pointerId;
  setJoystick(e.clientX, e.clientY);
});

window.addEventListener("pointermove", (e) => {
  if (state.joystick.activeId === e.pointerId) {
    setJoystick(e.clientX, e.clientY);
  }
});

window.addEventListener("pointerup", (e) => {
  if (state.joystick.activeId === e.pointerId) {
    state.joystick.activeId = null;
    resetJoystick();
  }
});

fireButton.addEventListener("pointerdown", () => {
  state.firing = true;
});
window.addEventListener("pointerup", () => {
  state.firing = false;
});

startButton.addEventListener("click", () => {
  resetGame();
  state.running = true;
  overlay.classList.add("hidden");
});

resetGame();
requestAnimationFrame(gameLoop);
