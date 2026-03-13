const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("startButton");
const mobileModeButton = document.getElementById("mobileModeButton");
const pcModeButton = document.getElementById("pcModeButton");
const controlHint = document.getElementById("controlHint");
const skillButton = document.getElementById("skillButton");
const skillCooldownEl = document.getElementById("skillCooldown");

const stickArea = document.getElementById("stickArea");
const stickKnob = document.getElementById("stickKnob");

const BOSS_TRIGGER_KILLS = 28;
const MAX_HP = 5;
const SKILL_COOLDOWN = 8;
const MISSILE_SPEED = 320;
const MISSILE_DAMAGE_ENEMY = 3;
const MISSILE_DAMAGE_MINION = 7;
const MISSILE_DAMAGE_BOSS = 12;

const state = {
  running: false,
  score: 0,
  hp: MAX_HP,
  level: 1,
  time: 0,
  lastFrame: 0,
  killsByPlayer: 0,
  bossSpawned: false,
  bossDefeated: false,
  joystick: { x: 0, y: 0, activeId: null },
  keyboard: { left: false, right: false, up: false, down: false },
  controlMode: null,
  fireCooldown: 0,
  skillCooldown: 0,
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
  missiles: [],
  enemies: [],
  enemyBullets: [],
  minions: [],
  boss: null,
  emergencyTimer: 0,
  clearTime: null,
  defeatEmergencyTimer: 0,
};

function resetGame() {
  state.score = 0;
  state.hp = MAX_HP;
  state.level = 1;
  state.time = 0;
  state.lastFrame = 0;
  state.killsByPlayer = 0;
  state.bossSpawned = false;
  state.bossDefeated = false;
  state.fireCooldown = 0;
  state.skillCooldown = 0;
  state.enemyCooldown = 0;
  state.hitFlashTimer = 0;
  state.invincibleTimer = 0;
  state.bullets = [];
  state.missiles = [];
  state.enemies = [];
  state.enemyBullets = [];
  state.minions = [];
  state.boss = null;
  state.emergencyTimer = 0;
  state.clearTime = null;
  state.defeatEmergencyTimer = 0;
  state.joystick.x = 0;
  state.joystick.y = 0;
  state.keyboard = { left: false, right: false, up: false, down: false };
  state.player.x = canvas.width * 0.14;
  state.player.y = canvas.height * 0.5;
  startButton.textContent = "ゲーム開始";
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  const full = "❤️".repeat(Math.max(0, state.hp));
  const empty = "🖤".repeat(Math.max(0, MAX_HP - state.hp));
  livesEl.textContent = full + empty;
  levelEl.textContent = state.bossSpawned && !state.bossDefeated ? "BOSS" : String(state.level);
  const ready = state.skillCooldown <= 0;
  skillButton.disabled = !ready || !state.running;
  skillButton.classList.toggle("cooldown", !ready || !state.running);
  skillCooldownEl.textContent = ready ? "READY" : `CD ${state.skillCooldown.toFixed(1)}s`;
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
    x: canvas.width + size + 30,
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
    entering: true,
    entryDelay: 0.35 + Math.random() * 0.2,
  });
}

function spawnBoss() {
  state.bossSpawned = true;
  state.enemies = [];
  state.emergencyTimer = 2.4;
  state.boss = {
    x: canvas.width + 140,
    y: canvas.height * 0.5,
    targetX: canvas.width * 0.83,
    vx: -45,
    vy: 60,
    size: 56,
    hp: 180,
    maxHp: 180,
    tripleShotCooldown: 0.6,
    specialCooldown: 4.5,
    beamDuration: 0,
    beamShotCooldown: 0,
    specialMode: null,
    normalPause: 0,
    pendingSpecial: null,
    entering: true,
    entryDelay: 1.0,
    healFlash: 0,
  };
}

function shoot() {
  state.bullets.push({
    x: state.player.x + state.player.size + 5,
    y: state.player.y,
    vx: 540,
    vy: 0,
    size: 4,
  });
}


function getSkillTargets(limit = 3) {
  const candidates = [];
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) candidates.push(enemy);
  }
  for (const minion of state.minions) {
    if (minion.hp > 0) candidates.push(minion);
  }
  if (state.boss && state.boss.hp > 0) candidates.push(state.boss);

  return candidates
    .sort(
      (a, b) =>
        Math.hypot(a.x - state.player.x, a.y - state.player.y) -
        Math.hypot(b.x - state.player.x, b.y - state.player.y),
    )
    .slice(0, limit);
}

function triggerSkill() {
  if (!state.running || state.skillCooldown > 0) return;
  const targets = getSkillTargets(3);
  if (targets.length === 0) return;

  const count = targets.length;
  for (let i = 0; i < count; i++) {
    const target = targets[i];
    const spread = (i - (count - 1) / 2) * 8;
    state.missiles.push({
      x: state.player.x + state.player.size + 6,
      y: state.player.y + spread,
      vx: MISSILE_SPEED,
      vy: 0,
      size: 7,
      target,
      homing: 12,
      wasHoming: true,
    });
  }
  state.skillCooldown = SKILL_COOLDOWN;
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

function fireOrangeMinionBeam(minion) {
  const dx = state.player.x - minion.x;
  const dy = state.player.y - minion.y;
  const length = Math.hypot(dx, dy) || 1;
  const dirX = dx / length;
  const dirY = dy / length;
  const speed = 540;
  for (let i = 0; i < 18; i++) {
    const offset = i * 14;
    state.enemyBullets.push({
      x: minion.x + dirX * offset,
      y: minion.y + dirY * offset,
      vx: dirX * speed,
      vy: dirY * speed,
      size: 5,
    });
  }
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
  const boss = state.boss;
  if (!boss) return;
  const baseAngle = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
  const speed = 280;
  for (const offset of [-0.25, 0, 0.25]) {
    const angle = baseAngle + offset;
    state.enemyBullets.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6,
    });
  }
}

function fireBossMultiBeam() {
  const boss = state.boss;
  if (!boss) return;
  const beamSpeed = 490;
  const dirs = [
    { x: -1, y: 0 },
    { x: -0.86, y: -0.5 },
    { x: -0.86, y: 0.5 },
    { x: -0.62, y: -0.78 },
    { x: -0.62, y: 0.78 },
  ];

  for (const dir of dirs) {
    state.enemyBullets.push({
      x: boss.x,
      y: boss.y,
      vx: dir.x * beamSpeed,
      vy: dir.y * beamSpeed,
      size: 6,
    });
  }
}

function fireBossPulseCore() {
  const boss = state.boss;
  if (!boss) return;
  const toPlayer = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
  const speed = 120;
  state.enemyBullets.push({
    x: boss.x,
    y: boss.y,
    vx: Math.cos(toPlayer) * speed,
    vy: Math.sin(toPlayer) * speed,
    size: 9,
    kind: "pulseCore",
    pulseTimer: 0.45,
    life: 3.4,
  });
}

function pulseCoreBurst(core) {
  const amount = 7;
  const speed = 220;
  for (let i = 0; i < amount; i++) {
    const angle = (Math.PI * 2 * i) / amount;
    state.enemyBullets.push({
      x: core.x,
      y: core.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4,
    });
  }
}

function spawnMinion(minionType) {
  const boss = state.boss;
  if (!boss) return;

  const angle = Math.random() * Math.PI * 2;
  const distance = boss.size + 35 + Math.random() * 55;
  const x = Math.max(80, Math.min(canvas.width - 80, boss.x + Math.cos(angle) * distance));
  const y = Math.max(80, Math.min(canvas.height - 80, boss.y + Math.sin(angle) * distance));

  if (minionType === "green") {
    state.minions.push({
      type: "green",
      x,
      y,
      centerX: x,
      centerY: y,
      orbitRadius: 14 + Math.random() * 14,
      orbitSpeed: 1.6 + Math.random() * 1.2,
      orbitPhase: Math.random() * Math.PI * 2,
      size: 14,
      hp: 16,
      maxHp: 16,
      cooldown: 3.2,
    });
  } else if (minionType === "orange") {
    state.minions.push({ type: "orange", x, y, size: 16, hp: 26, maxHp: 26, cooldown: 1.2 });
  } else if (minionType === "yellow") {
    state.minions.push({
      type: "yellow",
      x,
      y,
      centerX: x,
      centerY: y,
      orbitRadius: 16 + Math.random() * 16,
      orbitSpeed: 1.5 + Math.random() * 1.3,
      orbitPhase: Math.random() * Math.PI * 2,
      size: 15,
      hp: 20,
      maxHp: 20,
      cooldown: 1.4,
    });
  }
}

function chooseBossSpecial() {
  const aliveColors = new Set(state.minions.map((m) => m.type));
  const summonCandidates = ["green", "orange", "yellow"].filter((c) => !aliveColors.has(c));
  const summonAvailable = summonCandidates.length > 0;

  const options = summonAvailable ? ["beam", "pulse", "summon"] : ["beam", "pulse"];
  const special = options[Math.floor(Math.random() * options.length)];

  if (special === "summon") {
    const chosenColor = summonCandidates[Math.floor(Math.random() * summonCandidates.length)];
    spawnMinion(chosenColor);
  } else if (special === "beam") {
    const boss = state.boss;
    if (!boss) return;
    boss.specialMode = "beam";
    boss.beamDuration = 1.25;
    boss.beamShotCooldown = 0;
    boss.vx = 0;
    boss.vy = 0;
  } else {
    fireBossPulseCore();
  }
}

function updateBoss(delta) {
  const boss = state.boss;
  if (!boss) return;

  if (boss.entering) {
    boss.x -= 220 * delta;
    if (boss.x <= boss.targetX) {
      boss.x = boss.targetX;
      boss.entering = false;
    }
    return;
  }

  if (boss.entryDelay > 0) {
    boss.entryDelay -= delta;
    return;
  }

  boss.tripleShotCooldown -= delta;
  boss.specialCooldown -= delta;
  boss.normalPause = Math.max(0, boss.normalPause - delta);

  if (boss.pendingSpecial && boss.normalPause <= 0) {
    const pending = boss.pendingSpecial;
    boss.pendingSpecial = null;
    if (pending === "choose") {
      chooseBossSpecial();
      boss.normalPause = 0.35;
      boss.specialCooldown = 4.8;
    }
  }

  if (boss.specialMode === "beam") {
    boss.beamDuration -= delta;
    boss.beamShotCooldown -= delta;

    if (boss.beamShotCooldown <= 0) {
      fireBossMultiBeam();
      boss.beamShotCooldown = 0.14;
    }

    if (boss.beamDuration <= 0) {
      boss.specialMode = null;
      boss.vx = -50;
      boss.vy = 55;
      boss.normalPause = 0.4;
    }
    return;
  }

  boss.x += boss.vx * delta;
  boss.y += boss.vy * delta;

  const minBossY = boss.size + 6;
  const maxBossY = canvas.height - boss.size - 6;
  if (boss.y < minBossY || boss.y > maxBossY) {
    boss.vy *= -1;
    boss.y = Math.max(minBossY, Math.min(maxBossY, boss.y));
  }
  const minBossX = canvas.width * 0.58;
  const maxBossX = canvas.width * 0.98 - boss.size;
  if (boss.x < minBossX || boss.x > maxBossX) {
    boss.vx *= -1;
    boss.x = Math.max(minBossX, Math.min(maxBossX, boss.x));
  }

  if (boss.normalPause <= 0 && boss.tripleShotCooldown <= 0) {
    fireBossTripleShot();
    boss.tripleShotCooldown = 0.78;
  }

  if (!boss.pendingSpecial && boss.specialCooldown <= 0) {
    boss.pendingSpecial = "choose";
    boss.normalPause = 0.35;
  }
}

function applyControlMode(mode) {
  state.controlMode = mode;
  mobileModeButton.classList.toggle("active", mode === "mobile");
  pcModeButton.classList.toggle("active", mode === "pc");
  document.body.classList.toggle("pc-mode", mode === "pc");
  controlHint.textContent = mode === "pc" ? "十字キーで移動できます。" : "仮想スティックで移動します。";
}

function tryLandscapeLock() {
  const orientation = screen.orientation;
  if (orientation && typeof orientation.lock === "function") {
    orientation.lock("landscape").catch(() => {});
  }
}

function updateMinions(delta) {
  const boss = state.boss;
  for (const minion of state.minions) {
    minion.cooldown -= delta;

    if (minion.type === "green" || minion.type === "yellow") {
      minion.orbitPhase += minion.orbitSpeed * delta;
      minion.x = minion.centerX + Math.cos(minion.orbitPhase) * minion.orbitRadius;
      minion.y = minion.centerY + Math.sin(minion.orbitPhase * 1.25) * (minion.orbitRadius * 0.7);
    }

    if (minion.type === "green" && minion.cooldown <= 0) {
      if (boss) {
        boss.hp = Math.min(boss.maxHp, boss.hp + 5);
        boss.healFlash = 0.55;
      }
      minion.cooldown = 3.1;
    }

    if (minion.type === "orange" && minion.cooldown <= 0) {
      fireOrangeMinionBeam(minion);
      minion.cooldown = 1.55;
    }

    if (minion.type === "yellow" && minion.cooldown <= 0) {
      state.enemyBullets.push({
        x: minion.x,
        y: minion.y,
        vx: 0,
        vy: 0,
        size: 7,
        kind: "delayedSeed",
        delay: 0.75,
      });
      minion.cooldown = 1.55;
    }
  }
}

function update(delta) {
  if (!state.running) {
    if (state.defeatEmergencyTimer > 0) {
      state.defeatEmergencyTimer = Math.max(0, state.defeatEmergencyTimer - delta);
      if (state.defeatEmergencyTimer <= 0 && state.bossDefeated) {
        overlay.classList.remove("hidden");
        startButton.textContent = "もう一度";
        overlay.querySelector("h1").textContent = "CLEAR";
        const lines = overlay.querySelectorAll("p");
        if (lines[0]) lines[0].textContent = `クリアタイム: ${state.clearTime.toFixed(1)} 秒`;
        if (lines[1]) lines[1].textContent = "おめでとう！タップで再挑戦";
      }
    }
    return;
  }

  state.time += delta;
  state.level = 1 + Math.floor(state.time / 20);
  state.hitFlashTimer = Math.max(0, state.hitFlashTimer - delta);
  state.invincibleTimer = Math.max(0, state.invincibleTimer - delta);
  state.emergencyTimer = Math.max(0, state.emergencyTimer - delta);
  if (state.boss) state.boss.healFlash = Math.max(0, state.boss.healFlash - delta);

  const keyboardX = (state.keyboard.right ? 1 : 0) - (state.keyboard.left ? 1 : 0);
  const keyboardY = (state.keyboard.down ? 1 : 0) - (state.keyboard.up ? 1 : 0);
  const inputX = state.controlMode === "pc" ? keyboardX : state.joystick.x;
  const inputY = state.controlMode === "pc" ? keyboardY : state.joystick.y;
  const moveStrength = Math.hypot(inputX, inputY);
  if (moveStrength > 0.01) {
    const normalizedX = inputX / moveStrength;
    const normalizedY = inputY / moveStrength;
    state.player.x += normalizedX * state.player.speed * delta;
    state.player.y += normalizedY * state.player.speed * delta;
  }

  state.player.x = Math.max(state.player.size, Math.min(canvas.width - state.player.size, state.player.x));
  state.player.y = Math.max(state.player.size, Math.min(canvas.height - state.player.size, state.player.y));

  state.fireCooldown -= delta;
  state.skillCooldown = Math.max(0, state.skillCooldown - delta);
  if (state.fireCooldown <= 0) {
    shoot();
    state.fireCooldown = 0.18;
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

  for (const missile of state.missiles) {
    if (missile.target && missile.target.hp > 0) {
      const dx = missile.target.x - missile.x;
      const dy = missile.target.y - missile.y;
      const len = Math.hypot(dx, dy) || 1;
      const targetVx = (dx / len) * MISSILE_SPEED;
      const targetVy = (dy / len) * MISSILE_SPEED;
      missile.vx += (targetVx - missile.vx) * Math.min(1, missile.homing * delta);
      missile.vy += (targetVy - missile.vy) * Math.min(1, missile.homing * delta);
    } else if (missile.wasHoming) {
      missile.target = null;
      missile.wasHoming = false;
    }
    missile.x += missile.vx * delta;
    missile.y += missile.vy * delta;
  }

  for (const enemy of state.enemies) {
    if (enemy.entering) {
      enemy.x -= 260 * delta;
      if (enemy.x <= enemy.centerX) {
        enemy.x = enemy.centerX;
        enemy.entering = false;
      }
      continue;
    }

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
  updateMinions(delta);

  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;

    if (bullet.kind === "pulseCore") {
      bullet.pulseTimer -= delta;
      bullet.life -= delta;
      if (bullet.pulseTimer <= 0) {
        pulseCoreBurst(bullet);
        bullet.pulseTimer = 0.45;
      }
      if (bullet.life <= 0) {
        bullet.x = -999;
      }
    }

    if (bullet.kind === "delayedSeed") {
      bullet.delay -= delta;
      if (bullet.delay <= 0) {
        const dx = state.player.x - bullet.x;
        const dy = state.player.y - bullet.y;
        const len = Math.hypot(dx, dy) || 1;
        bullet.vx = (dx / len) * 300;
        bullet.vy = (dy / len) * 300;
        bullet.kind = "yellowHoming";
        bullet.homing = 0.28;
        bullet.size = 6;
      }
    }

    if (bullet.kind === "yellowHoming") {
      const dx = state.player.x - bullet.x;
      const dy = state.player.y - bullet.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = Math.hypot(bullet.vx, bullet.vy) || 300;
      const targetVx = (dx / len) * speed;
      const targetVy = (dy / len) * speed;
      bullet.vx += (targetVx - bullet.vx) * Math.min(1, bullet.homing * delta);
      bullet.vy += (targetVy - bullet.vy) * Math.min(1, bullet.homing * delta);
      if (Math.hypot(bullet.vx, bullet.vy) < 36) {
        bullet.x = -999;
      }
      if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
        bullet.x = -999;
      }
    }
  }

  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    for (const missile of state.missiles) {
      const mx = enemy.x - missile.x;
      const my = enemy.y - missile.y;
      if (enemy.hp > 0 && Math.hypot(mx, my) < enemy.size + missile.size) {
        enemy.hp -= MISSILE_DAMAGE_ENEMY;
        missile.x = canvas.width + 999;
        if (!enemy.isLarge) burstEnemy(enemy);
        state.killsByPlayer += enemy.killValue;
        state.score += 12 + enemy.maxHp * 2;
      }
    }

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
          if (!enemy.isLarge) {
            burstEnemy(enemy);
          }
          state.killsByPlayer += enemy.killValue;
          state.score += 12 + enemy.maxHp * 2;
        }
      }
    }
  }

  for (const minion of state.minions) {
    if (minion.hp <= 0) continue;
    for (const missile of state.missiles) {
      if (minion.hp > 0 && Math.hypot(minion.x - missile.x, minion.y - missile.y) < minion.size + missile.size) {
        minion.hp -= MISSILE_DAMAGE_MINION;
        missile.x = canvas.width + 999;
        state.score += 35;
      }
    }

    if (Math.hypot(minion.x - state.player.x, minion.y - state.player.y) < minion.size + state.player.size * 0.7) {
      takePlayerDamage();
    }

    for (const bullet of state.bullets) {
      if (Math.hypot(minion.x - bullet.x, minion.y - bullet.y) < minion.size + bullet.size) {
        minion.hp -= 1;
        bullet.x = canvas.width + 999;
        if (minion.hp <= 0) {
          state.score += 35;
        }
      }
    }
  }

  if (!state.bossSpawned && state.killsByPlayer >= BOSS_TRIGGER_KILLS) {
    spawnBoss();
  }

  const boss = state.boss;
  if (boss) {
    for (const missile of state.missiles) {
      if (boss.hp > 0 && Math.hypot(boss.x - missile.x, boss.y - missile.y) < boss.size + missile.size) {
        boss.hp -= MISSILE_DAMAGE_BOSS;
        missile.x = canvas.width + 999;
      }
    }

    if (Math.hypot(boss.x - state.player.x, boss.y - state.player.y) < boss.size + state.player.size * 0.9) {
      takePlayerDamage();
    }

    for (const bullet of state.bullets) {
      if (Math.hypot(boss.x - bullet.x, boss.y - bullet.y) < boss.size + bullet.size) {
        boss.hp -= 1;
        bullet.x = canvas.width + 999;
        if (boss.hp <= 0) {
          state.score += 800;
          state.bossDefeated = true;
          state.boss = null;
          state.minions = [];
          state.running = false;
          state.clearTime = state.time;
          state.defeatEmergencyTimer = 2.0;
          overlay.classList.add("hidden");
        }
      }
    }
  }

  for (const bullet of state.enemyBullets) {
    if (Math.hypot(bullet.x - state.player.x, bullet.y - state.player.y) < bullet.size + state.player.size * 0.7) {
      takePlayerDamage();
      bullet.x = -999;
    }
  }

  state.bullets = state.bullets.filter((b) => b.x < canvas.width + 50 && b.y > -50 && b.y < canvas.height + 50);
  state.missiles = state.missiles.filter(
    (m) => (m.target && m.target.hp > 0) || (m.x > -80 && m.x < canvas.width + 80 && m.y > -80 && m.y < canvas.height + 80),
  );
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  state.minions = state.minions.filter((m) => m.hp > 0);
  state.enemyBullets = state.enemyBullets.filter(
    (b) => b.x > -80 && b.x < canvas.width + 80 && b.y > -80 && b.y < canvas.height + 80,
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

  if (boss.healFlash > 0) {
    ctx.strokeStyle = `rgba(120, 255, 170, ${Math.min(1, boss.healFlash + 0.2)})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, boss.size * (1.05 + (0.6 - boss.healFlash) * 0.18), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillRect(boss.x - boss.size, boss.y + boss.size + 8, boss.size * 2, 5);
  ctx.fillStyle = "#ff5eff";
  ctx.fillRect(boss.x - boss.size, boss.y + boss.size + 8, (boss.hp / boss.maxHp) * boss.size * 2, 5);
}

function drawMinion(minion) {
  const color = minion.type === "green" ? "#58e078" : minion.type === "orange" ? "#ff9a30" : "#ffd93a";
  ctx.save();
  ctx.translate(minion.x, minion.y);
  ctx.fillStyle = color;

  if (minion.type === "green") {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      const r = i % 2 === 0 ? minion.size : minion.size * 0.55;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else if (minion.type === "orange") {
    ctx.beginPath();
    ctx.rect(-minion.size * 0.8, -minion.size * 0.8, minion.size * 1.6, minion.size * 1.6);
    ctx.fill();
  } else {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / 3;
      const px = Math.cos(a) * minion.size;
      const py = Math.sin(a) * minion.size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(minion.x - minion.size, minion.y + minion.size + 4, minion.size * 2, 3);
  ctx.fillStyle = color;
  ctx.fillRect(minion.x - minion.size, minion.y + minion.size + 4, (minion.hp / minion.maxHp) * minion.size * 2, 3);
}

function drawEmergencyBanner() {
  const t = state.emergencyTimer;
  if (t <= 0) return;
  const blink = Math.floor(t * 10) % 2 === 0;
  ctx.save();
  ctx.fillStyle = blink ? "rgba(255,40,40,0.82)" : "rgba(160,0,0,0.82)";
  ctx.fillRect(0, canvas.height * 0.42, canvas.width, 64);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, canvas.height * 0.42 + 6, canvas.width - 16, 52);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("⚠ ボス出現！ ⚠", canvas.width / 2, canvas.height * 0.42 + 43);
  ctx.restore();
}

function drawDefeatBanner() {
  const t = state.defeatEmergencyTimer;
  if (t <= 0) return;
  const blink = Math.floor(t * 10) % 2 === 0;
  ctx.save();
  ctx.fillStyle = blink ? "rgba(255,220,40,0.85)" : "rgba(180,120,0,0.85)";
  ctx.fillRect(0, canvas.height * 0.42, canvas.width, 64);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, canvas.height * 0.42 + 6, canvas.width - 16, 52);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("★ ボス撃破！ ★", canvas.width / 2, canvas.height * 0.42 + 43);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStarField();
  drawShip();

  for (const bullet of state.bullets) {
    const glow = ctx.createRadialGradient(bullet.x - 1, bullet.y, 1, bullet.x, bullet.y, bullet.size * 2.8);
    glow.addColorStop(0, "rgba(255,255,255,0.95)");
    glow.addColorStop(0.35, "rgba(173,242,255,0.95)");
    glow.addColorStop(1, "rgba(40,180,255,0.05)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const missile of state.missiles) {
    const angle = Math.atan2(missile.vy, missile.vx);
    ctx.save();
    ctx.translate(missile.x, missile.y);
    ctx.rotate(angle);
    ctx.fillStyle = "#ffd0ff";
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-7, 5);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-7, -5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8cf5ff";
    ctx.fillRect(-11, -2, 6, 4);
    ctx.restore();
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

  if (state.boss) drawBoss(state.boss);
  for (const minion of state.minions) drawMinion(minion);

  for (const bullet of state.enemyBullets) {
    let core = "#ff9a30";
    let outer = "rgba(255, 120, 30, 0.05)";
    if (bullet.kind === "pulseCore") {
      core = "#ff5ec9";
      outer = "rgba(255, 20, 170, 0.08)";
    } else if (bullet.kind === "delayedSeed") {
      core = "#ffe24a";
      outer = "rgba(255, 228, 80, 0.08)";
    } else if (bullet.kind === "yellowHoming") {
      core = "#ffd166";
      outer = "rgba(255, 190, 80, 0.08)";
    }
    const glow = ctx.createRadialGradient(bullet.x, bullet.y, 1, bullet.x, bullet.y, bullet.size * 2.6);
    glow.addColorStop(0, "rgba(255,255,255,0.95)");
    glow.addColorStop(0.45, core);
    glow.addColorStop(1, outer);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size * 1.45, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEmergencyBanner();
  drawDefeatBanner();
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
  if (state.controlMode !== "mobile") return;
  e.preventDefault();
  state.joystick.activeId = e.pointerId;
  setJoystick(e.clientX, e.clientY);
});
stickArea.addEventListener("contextmenu", (e) => e.preventDefault());
stickArea.addEventListener("selectstart", (e) => e.preventDefault());

window.addEventListener("pointermove", (e) => {
  if (state.controlMode === "mobile" && state.joystick.activeId === e.pointerId) {
    setJoystick(e.clientX, e.clientY);
  }
});

window.addEventListener("pointerup", (e) => {
  if (state.joystick.activeId === e.pointerId) {
    state.joystick.activeId = null;
    resetJoystick();
  }
});

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    e.preventDefault();
  }
  if (state.controlMode !== "pc") return;
  if (e.key === "ArrowLeft") state.keyboard.left = true;
  if (e.key === "ArrowRight") state.keyboard.right = true;
  if (e.key === "ArrowUp") state.keyboard.up = true;
  if (e.key === "ArrowDown") state.keyboard.down = true;
});

window.addEventListener("keyup", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    e.preventDefault();
  }
  if (e.key === "ArrowLeft") state.keyboard.left = false;
  if (e.key === "ArrowRight") state.keyboard.right = false;
  if (e.key === "ArrowUp") state.keyboard.up = false;
  if (e.key === "ArrowDown") state.keyboard.down = false;
});

mobileModeButton.addEventListener("click", () => applyControlMode("mobile"));
pcModeButton.addEventListener("click", () => applyControlMode("pc"));
skillButton.addEventListener("click", triggerSkill);

startButton.addEventListener("click", () => {
  if (!state.controlMode) {
    controlHint.textContent = "先に操作方式を選択してください。";
    return;
  }
  overlay.querySelector("h1").textContent = "2D Shooting Game";
  resetGame();
  state.running = true;
  if (state.controlMode === "mobile") {
    tryLandscapeLock();
  }
  overlay.classList.add("hidden");
});

resetGame();
requestAnimationFrame(gameLoop);
