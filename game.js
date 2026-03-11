const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const hpEl = document.getElementById("hp");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("startButton");

const stickArea = document.getElementById("stickArea");
const stickKnob = document.getElementById("stickKnob");

const BOSS_TRIGGER_KILLS = 28;

const state = {
  running: false,
  score: 0,
  hp: 5,
  level: 1,
  time: 0,
  lastFrame: 0,
  killsByPlayer: 0,
  bossSpawned: false,
  bossDefeated: false,
  joystick: { x: 0, y: 0, activeId: null },
  fireCooldown: 0,
  enemyCooldown: 0,
  hitFlashTimer: 0,
  invincibleTimer: 0,
  player: {
    x: 0,
    y: 0,
    size: 16,
    speed: 320,
  },
  bullets: [],
  enemies: [],
  enemyBullets: [],
  boss: null,
};

function resetGame() {
  state.score = 0;
  state.hp = 5;
  state.level = 1;
  state.time = 0;
  state.lastFrame = 0;
  state.killsByPlayer = 0;
  state.bossSpawned = false;
  state.bossDefeated = false;
  state.fireCooldown = 0;
  state.enemyCooldown = 0;
  state.hitFlashTimer = 0;
  state.invincibleTimer = 0;
  state.bullets = [];
  state.enemies = [];
  state.enemyBullets = [];
  state.boss = null;
  state.player.x = canvas.width * 0.14;
  state.player.y = canvas.height * 0.5;
  startButton.textContent = "ゲーム開始";
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  hpEl.textContent = String(state.hp);
  levelEl.textContent = state.bossSpawned && !state.bossDefeated ? "BOSS" : String(state.level);
}

function spawnEnemy() {
  if (state.enemies.length >= 6 || state.bossSpawned) return;

  const isLarge = Math.random() < 0.35;
  const size = isLarge ? 26 + Math.random() * 6 : 14 + Math.random() * 7;
  const y = Math.random() * (canvas.height - size * 3) + size * 1.5;
  const centerX = canvas.width * (0.72 + Math.random() * 0.2);
  const centerY = y;
  const life = 10 + Math.random() * 4;
  const baseHp = 2 + Math.floor(state.level / 4);
  const sizeBonusHp = isLarge ? 2 : 0;
  const maxHp = baseHp + sizeBonusHp;

  state.enemies.push({
    x: centerX,
    y: centerY,
    centerX,
    centerY,
    orbitRadius: 20 + Math.random() * 35,
    orbitSpeed: 1.5 + Math.random() * 2,
    orbitPhase: Math.random() * Math.PI * 2,
    size,
    hp: maxHp,
    fireCooldown: 0.8 + Math.random() * 0.7,
    life,
    maxHp,
    killValue: isLarge ? 2 : 1,
    isLarge,
  });
}

function spawnBoss() {
  state.bossSpawned = true;
  state.enemies = [];
  state.boss = {
    x: canvas.width * 0.8,
    y: canvas.height * 0.5,
    vx: -45,
    vy: 60,
    size: 56,
    hp: 180,
    maxHp: 180,
    tripleShotCooldown: 0.6,
    beamCooldown: 6,
    beamDuration: 0,
    beamShotCooldown: 0,
    splitCooldown: 2.5,
  };
}

function shoot() {
  state.bullets.push({
    x: state.player.x + state.player.size + 5,
    y: state.player.y,
    vx: 540,
    vy: 0,
    size: 4,
    isPlayer: true,
  });
}

function takePlayerDamage() {
  if (state.invincibleTimer > 0 || !state.running) return;
  state.hp -= 1;
  state.hitFlashTimer = 0.8;
  state.invincibleTimer = 1.1;

  if (state.hp <= 0) {
    state.running = false;
    overlay.classList.remove("hidden");
    startButton.textContent = "リトライ";
  }
}

function shootEnemy(enemy) {
  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const length = Math.hypot(dx, dy) || 1;
  const speed = 220 + state.level * 14;

  state.enemyBullets.push({
    x: enemy.x,
    y: enemy.y,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
    size: 5,
  });
}

function burstEnemy(enemy) {
  const amount = 10;
  const speed = 180 + state.level * 10;
  for (let i = 0; i < amount; i++) {
    const angle = (Math.PI * 2 * i) / amount;
    state.enemyBullets.push({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4,
    });
  }
}

function fireBossTripleShot() {
  if (!state.boss) return;
  const baseAngle = Math.atan2(state.player.y - state.boss.y, state.player.x - state.boss.x);
  const speed = 280;
  for (const offset of [-0.25, 0, 0.25]) {
    const angle = baseAngle + offset;
    state.enemyBullets.push({
      x: state.boss.x,
      y: state.boss.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6,
    });
  }
}

function fireBossBeam() {
  if (!state.boss) return;
  const beamSpeed = 460;
  state.enemyBullets.push({
    x: state.boss.x - state.boss.size * 0.7,
    y: state.boss.y,
    vx: -beamSpeed,
    vy: 0,
    size: 6,
  });
}

function fireBossSplitBurst() {
  if (!state.boss) return;
  const amount = 6;
  const speed = 160;
  for (let i = 0; i < amount; i++) {
    const angle = (Math.PI * 2 * i) / amount;
    state.enemyBullets.push({
      x: state.boss.x,
      y: state.boss.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 7,
      splitAfter: 0.7,
      didSplit: false,
    });
  }
}

function splitBullet(bullet) {
  const amount = 5;
  const speed = 230;
  for (let i = 0; i < amount; i++) {
    const angle = (Math.PI * 2 * i) / amount;
    state.enemyBullets.push({
      x: bullet.x,
      y: bullet.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4,
    });
  }
}

function updateBoss(delta) {
  const boss = state.boss;
  if (!boss) return;

  boss.beamCooldown -= delta;
  boss.tripleShotCooldown -= delta;
  boss.splitCooldown -= delta;

  if (boss.beamDuration > 0) {
    boss.beamDuration -= delta;
    boss.beamShotCooldown -= delta;
    if (boss.beamShotCooldown <= 0) {
      fireBossBeam();
      boss.beamShotCooldown = 0.08;
    }

    if (boss.beamDuration <= 0) {
      boss.beamCooldown = 6.5;
      boss.vx = -50;
      boss.vy = 55;
    }
  } else {
    boss.x += boss.vx * delta;
    boss.y += boss.vy * delta;

    if (boss.y < boss.size || boss.y > canvas.height - boss.size) {
      boss.vy *= -1;
    }
    if (boss.x < canvas.width * 0.62 || boss.x > canvas.width * 0.9) {
      boss.vx *= -1;
    }

    if (boss.tripleShotCooldown <= 0) {
      fireBossTripleShot();
      boss.tripleShotCooldown = 0.75;
    }

    if (boss.beamCooldown <= 0) {
      boss.beamDuration = 1.4;
      boss.beamShotCooldown = 0;
      boss.vx = 0;
      boss.vy = 0;
    }

    const nearPlayer = Math.hypot(state.player.x - boss.x, state.player.y - boss.y) < 230;
    if (nearPlayer && boss.splitCooldown <= 0) {
      fireBossSplitBurst();
      boss.splitCooldown = 3.2;
    }
  }
}

function update(delta) {
  if (!state.running) return;

  state.time += delta;
  state.level = 1 + Math.floor(state.time / 20);
  state.hitFlashTimer = Math.max(0, state.hitFlashTimer - delta);
  state.invincibleTimer = Math.max(0, state.invincibleTimer - delta);

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
  if (state.fireCooldown <= 0) {
    shoot();
    state.fireCooldown = 0.14;
  }

  state.enemyCooldown -= delta;
  if (state.enemyCooldown <= 0 && !state.bossSpawned) {
    spawnEnemy();
    state.enemyCooldown = Math.max(0.25, 1.1 - state.level * 0.07);
  }

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
  }

  for (const enemy of state.enemies) {
    enemy.orbitPhase += enemy.orbitSpeed * delta;
    enemy.x = enemy.centerX + Math.cos(enemy.orbitPhase) * enemy.orbitRadius;
    enemy.y = enemy.centerY + Math.sin(enemy.orbitPhase * 1.3) * (enemy.orbitRadius * 0.65);

    enemy.fireCooldown -= delta;
    if (enemy.fireCooldown <= 0) {
      shootEnemy(enemy);
      enemy.fireCooldown = Math.max(0.75, 1.7 - state.level * 0.06) + Math.random() * 0.45;
    }

    enemy.life -= delta;
    if (enemy.life <= 0 && enemy.hp > 0) {
      burstEnemy(enemy);
      enemy.hp = 0;
    }
  }

  updateBoss(delta);

  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;

    if (bullet.splitAfter !== undefined && !bullet.didSplit) {
      bullet.splitAfter -= delta;
      if (bullet.splitAfter <= 0) {
        splitBullet(bullet);
        bullet.didSplit = true;
        bullet.x = -999;
      }
    }
  }

  for (const enemy of state.enemies) {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    if (Math.hypot(dx, dy) < enemy.size + state.player.size * 0.8) {
      takePlayerDamage();
      enemy.hp = 0;
    }

    for (const bullet of state.bullets) {
      const bx = enemy.x - bullet.x;
      const by = enemy.y - bullet.y;
      if (Math.hypot(bx, by) < enemy.size + bullet.size) {
        enemy.hp -= 1;
        bullet.x = canvas.width + 999;
        if (enemy.hp <= 0) {
          state.killsByPlayer += enemy.killValue;
          state.score += 12 + enemy.maxHp * 2;
        }
      }
    }
  }

  if (!state.bossSpawned && state.killsByPlayer >= BOSS_TRIGGER_KILLS) {
    spawnBoss();
  }

  const boss = state.boss;
  if (boss) {
    const hitBoss = Math.hypot(boss.x - state.player.x, boss.y - state.player.y) < boss.size + state.player.size * 0.9;
    if (hitBoss) {
      takePlayerDamage();
    }

    for (const bullet of state.bullets) {
      const dx = boss.x - bullet.x;
      const dy = boss.y - bullet.y;
      if (Math.hypot(dx, dy) < boss.size + bullet.size) {
        boss.hp -= 1;
        bullet.x = canvas.width + 999;
        if (boss.hp <= 0) {
          state.score += 800;
          state.bossDefeated = true;
          state.boss = null;
          state.running = false;
          overlay.classList.remove("hidden");
          startButton.textContent = "もう一度";
          overlay.querySelector("h1").textContent = "Boss撃破！";
        }
      }
    }
  }

  for (const bullet of state.enemyBullets) {
    const dx = bullet.x - state.player.x;
    const dy = bullet.y - state.player.y;
    if (Math.hypot(dx, dy) < bullet.size + state.player.size * 0.7) {
      takePlayerDamage();
      bullet.x = -999;
    }
  }

  state.bullets = state.bullets.filter((b) => b.x < canvas.width + 50 && b.y > -50 && b.y < canvas.height + 50);
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  state.enemyBullets = state.enemyBullets.filter(
    (b) => b.x > -60 && b.x < canvas.width + 60 && b.y > -60 && b.y < canvas.height + 60,
  );

  if (!state.running && state.hp <= 0) {
    overlay.querySelector("h1").textContent = "Game Over";
  }

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
  const isFlashing = state.hitFlashTimer > 0 && Math.floor(state.hitFlashTimer * 16) % 2 === 0;

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = isFlashing ? "#ffffff" : "#4ff3ff";
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.7, size * 0.8);
  ctx.lineTo(-size * 0.7, -size * 0.8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isFlashing ? "#ff8a8a" : "#b3f9ff";
  ctx.beginPath();
  ctx.arc(-size * 0.1, 0, size * 0.28, 0, Math.PI * 2);
  ctx.fill();

  if (isFlashing) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.05, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBoss(boss) {
  ctx.save();
  ctx.translate(boss.x, boss.y);

  ctx.fillStyle = "#9a66ff";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const radius = i % 2 === 0 ? boss.size : boss.size * 0.62;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f4a8ff";
  ctx.beginPath();
  ctx.arc(0, 0, boss.size * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillRect(boss.x - boss.size, boss.y + boss.size + 8, boss.size * 2, 5);
  ctx.fillStyle = "#ff5eff";
  ctx.fillRect(boss.x - boss.size, boss.y + boss.size + 8, (boss.hp / boss.maxHp) * boss.size * 2, 5);
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
    ctx.fillRect(enemy.x - enemy.size, enemy.y + enemy.size + 4, (enemy.hp / enemy.maxHp) * enemy.size * 2, 3);
  }

  if (state.boss) {
    drawBoss(state.boss);
  }

  for (const bullet of state.enemyBullets) {
    ctx.fillStyle = "#ff9a30";
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
    ctx.fill();
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

startButton.addEventListener("click", () => {
  overlay.querySelector("h1").textContent = "2D Shooting Game";
  resetGame();
  state.running = true;
  overlay.classList.add("hidden");
});

resetGame();
requestAnimationFrame(gameLoop);
