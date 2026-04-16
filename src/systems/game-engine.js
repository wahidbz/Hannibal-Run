import { CONFIG } from '../core/config.js';
import { easeInOutSine, easeOutCubic, clamp, lerp, mapRange, rand } from '../core/utils.js';
import { ElephantEntity } from '../entities/elephant.js';
import { createCoinTrail, createElephantCoinBurst, createElephantPower, createObstacle } from '../entities/obstacles.js';
import { PlayerEntity } from '../entities/player.js';

const hexToRgb = (hex) => {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
};

const mixHex = (a, b, t) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(lerp(ca.r, cb.r, t));
  const g = Math.round(lerp(ca.g, cb.g, t));
  const bCh = Math.round(lerp(ca.b, cb.b, t));
  return `rgb(${r}, ${g}, ${bCh})`;
};

const noise = (seed) => {
  const x = Math.sin(seed * 78.233 + 19.19) * 43758.5453;
  return x - Math.floor(x);
};

export class GameEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.callbacks = callbacks;
    this.language = 'en';
    this.running = false;
    this.raf = null;
    this.lastTime = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.player = new PlayerEntity(CONFIG.player);
    this.elephant = new ElephantEntity({
      coinTimer: () => rand(CONFIG.elephantCoinGap.min, CONFIG.elephantCoinGap.max),
      powerTimer: () => rand(CONFIG.elephantPowerGap.min, CONFIG.elephantPowerGap.max)
    });
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.resetState();
  }

  setLanguage(language) {
    this.language = language;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(320, rect.width);
    this.height = Math.max(560, rect.height);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.horizonY = this.height * 0.28;
    this.playerBaseY = this.height * 0.84;
  }

  resetState() {
    this.distance = 0;
    this.score = 0;
    this.coins = 0;
    this.speed = CONFIG.baseSpeed;
    this.runTime = 0;
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
    this.activePower = null;
    this.powerTimer = 0;
    this.obstacleTimer = 0.9;
    this.coinTrailTimer = 1.15;
    this.environmentIndex = 0;
    this.nextEnvironmentIndex = 1;
    this.environmentBlend = 0;
    this.environmentClock = 0;
    this.statusTimer = 0;
    this.hitFlash = 0;
    this.cameraShake = 0;
    this.dustTimer = 0;
    this.player.reset();
    this.elephant.reset();
    this.emitHud();
  }

  start() {
    this.resetState();
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  loop(time) {
    if (!this.running) return;
    const dt = Math.min(0.033, (time - this.lastTime) / 1000 || 0.016);
    this.lastTime = time;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame((next) => this.loop(next));
  }

  handleAction(action) {
    if (!this.running) return;
    const performed = this.player.action(action);
    if (performed === 'jump') {
      this.spawnDustBurst(10, '#d0a262');
      this.spawnJumpGlow();
      this.callbacks.onJump?.();
    }
    if (performed === 'slide') {
      this.spawnDustBurst(12, '#ccb08d');
      this.spawnSlideTrail();
      this.callbacks.onSlide?.();
    }
  }

  update(dt) {
    this.runTime += dt;
    const speedProgress = 1 - Math.exp(-this.runTime * CONFIG.accelerationCurve);
    this.speed = lerp(CONFIG.baseSpeed, CONFIG.maxSpeed, speedProgress);
    this.distance += this.speed * dt * 0.92;
    this.score = Math.floor(this.distance * 5 + this.coins * 28);

    this.updateEnvironment(dt);
    this.player.update(dt, this.speed);

    if (this.activePower) {
      this.powerTimer -= dt;
      if (this.powerTimer <= 0) {
        this.activePower = null;
        this.powerTimer = 0;
        this.callbacks.onPowerChange?.(null, 0);
      } else {
        this.callbacks.onPowerChange?.(this.activePower, this.powerTimer);
      }
    }

    this.statusTimer -= dt;
    if (this.statusTimer <= 0) {
      this.callbacks.onElephantStatus?.(this.callbacks.getCopy?.('elephantReady') || 'Elephant ready');
      this.statusTimer = 0;
    }

    this.elephant.update(dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.5);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 4.2);

    this.obstacleTimer -= dt * (this.speed / CONFIG.baseSpeed);
    if (this.obstacleTimer <= 0) {
      this.spawnObstacle();
      this.obstacleTimer = rand(CONFIG.obstacleGap.min, CONFIG.obstacleGap.max);
    }

    this.coinTrailTimer -= dt;
    if (this.coinTrailTimer <= 0) {
      this.collectibles.push(...createCoinTrail());
      this.coinTrailTimer = rand(CONFIG.coinGap.min, CONFIG.coinGap.max);
    }

    if (this.elephant.coinTimer <= 0) {
      this.spawnElephantCoins();
      this.elephant.coinTimer = rand(CONFIG.elephantCoinGap.min, CONFIG.elephantCoinGap.max);
    }
    if (this.elephant.powerTimer <= 0) {
      this.spawnElephantPower();
      this.elephant.powerTimer = rand(CONFIG.elephantPowerGap.min, CONFIG.elephantPowerGap.max);
    }

    const moveStep = this.speed * dt;
    this.obstacles.forEach((item) => {
      item.z -= moveStep;
    });
    this.collectibles.forEach((item) => {
      item.z -= moveStep;
      item.wobble += dt * 6;
      if (item.airborne) {
        item.throwT = clamp(item.throwT + dt / item.throwDuration, 0, 1);
        if (item.throwT >= 1) item.airborne = false;
      }
      if (this.activePower === 'magnet' && item.type === 'coin') {
        const laneDiff = Math.abs(item.lane - this.player.lane);
        if (item.z < 34 && laneDiff < 1.2) item.magnetized = true;
      }
      if (item.magnetized) item.lane = lerp(item.lane, this.player.lane, 0.08);
    });

    this.handleCollisions();
    this.updateParticles(dt);

    this.obstacles = this.obstacles.filter((item) => item.z > -8 && !item.hit);
    this.collectibles = this.collectibles.filter((item) => item.z > -8 && !item.collected);

    this.dustTimer -= dt;
    if (this.player.grounded && this.dustTimer <= 0) {
      this.spawnFootDust();
      this.dustTimer = this.player.isSliding ? 0.028 : 0.075;
    }
    if (this.player.isSliding && Math.random() > 0.45) this.spawnSlideTrail();

    this.emitHud();
  }

  updateEnvironment(dt) {
    this.environmentClock += dt;
    if (this.environmentClock > 17) {
      this.environmentBlend = clamp(this.environmentBlend + dt * 0.34, 0, 1);
      if (this.environmentBlend >= 1) {
        this.environmentIndex = this.nextEnvironmentIndex;
        this.nextEnvironmentIndex = (this.environmentIndex + 1) % CONFIG.environments.length;
        this.environmentBlend = 0;
        this.environmentClock = 0;
      }
    }
  }

  emitHud() {
    this.callbacks.onHudUpdate?.({
      score: this.score,
      coins: this.coins,
      speedMultiplier: this.speed / CONFIG.baseSpeed,
      environmentIndex: this.environmentIndex
    });
  }

  spawnObstacle() {
    const candidate = createObstacle(CONFIG.spawnDistance);
    const farSameLane = this.obstacles.some((item) => item.lane === candidate.lane && item.z > 55);
    if (farSameLane) return;
    this.obstacles.push(candidate);
  }

  spawnElephantCoins() {
    this.collectibles.push(...createElephantCoinBurst());
    this.elephant.triggerThrow();
    this.statusTimer = 1.15;
    this.callbacks.onElephantStatus?.(this.callbacks.getCopy?.('elephantThrowingCoins') || 'Elephant hurls coins!');
  }

  spawnElephantPower() {
    this.collectibles.push(createElephantPower());
    this.elephant.triggerThrow();
    this.statusTimer = 1.35;
    this.callbacks.onElephantStatus?.(this.callbacks.getCopy?.('elephantThrowingPower') || 'Elephant launches a relic!');
  }

  handleCollisions() {
    const laneDiff = (lane) => Math.abs(lane - this.player.lane);

    for (const item of this.collectibles) {
      if (item.collected) continue;
      if (item.z > CONFIG.player.collisionDepth || item.z < 0) continue;
      if (laneDiff(item.lane) > 0.45) continue;
      item.collected = true;
      if (item.type === 'coin') {
        this.coins += 1;
        this.spawnCollectEffect('#ffd257');
        this.callbacks.onCoin?.();
      } else if (item.type === 'power') {
        this.activePower = item.powerType;
        this.powerTimer = CONFIG.powerUps[item.powerType];
        this.spawnCollectEffect(item.powerType === 'shield' ? '#79e29a' : '#79c8ff', 18);
        this.callbacks.onPower?.();
      }
    }

    for (const obstacle of this.obstacles) {
      if (obstacle.hit) continue;
      if (obstacle.z > CONFIG.player.collisionDepth || obstacle.z < 0) continue;
      if (laneDiff(obstacle.lane) > 0.42) continue;

      const safe =
        (obstacle.type === 'crate' && this.player.jumpY > 34) ||
        (obstacle.type === 'low' && this.player.jumpY > 42) ||
        (obstacle.type === 'high' && this.player.isSliding);

      if (safe) continue;

      if (this.activePower === 'shield') {
        obstacle.hit = true;
        this.activePower = null;
        this.powerTimer = 0;
        this.callbacks.onPowerChange?.(null, 0);
        this.spawnHitBurst('#79e29a');
        return;
      }

      this.running = false;
      this.player.hit();
      this.callbacks.onHit?.();
      this.hitFlash = 1;
      this.cameraShake = 1;
      this.spawnHitBurst('#ff7d63');
      this.callbacks.onGameOver?.({ score: this.score, distance: Math.floor(this.distance), coins: this.coins });
      return;
    }
  }

  spawnScreenParticles(x, y, color, count = 10, spread = 60, size = 6, type = 'spark') {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(20, spread);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(10, 30),
        life: rand(0.35, 0.75),
        maxLife: rand(0.35, 0.75),
        color,
        size: rand(2, size),
        type
      });
    }
  }

  spawnCollectEffect(color, count = 12) {
    const pos = this.getPlayerScreenPosition();
    this.spawnScreenParticles(pos.x, pos.y - 44, color, count, 110, 8, 'spark');
  }

  spawnHitBurst(color = '#ff7d63') {
    const pos = this.getPlayerScreenPosition();
    this.spawnScreenParticles(pos.x, pos.y - 24, color, 24, 170, 11, 'spark');
  }

  spawnDustBurst(count = 10, color = '#d0a262') {
    const pos = this.getPlayerScreenPosition();
    this.spawnScreenParticles(pos.x, pos.y, color, count, 72, 8, 'dust');
  }

  spawnFootDust() {
    const pos = this.getPlayerScreenPosition();
    this.particles.push({
      x: pos.x + rand(-13, 13),
      y: pos.y + rand(-4, 4),
      vx: rand(-18, 18),
      vy: rand(-12, -2),
      life: rand(0.18, 0.4),
      maxLife: 0.4,
      color: '#d8ac68',
      size: rand(3, 7),
      type: 'dust'
    });
  }

  spawnJumpGlow() {
    const pos = this.getPlayerScreenPosition();
    this.spawnScreenParticles(pos.x, pos.y - 42, '#ffe7aa', 14, 95, 7, 'spark');
  }

  spawnSlideTrail() {
    const pos = this.getPlayerScreenPosition();
    this.particles.push({
      x: pos.x + rand(-12, 12),
      y: pos.y + 2,
      vx: rand(-10, 10),
      vy: rand(-2, 4),
      life: rand(0.15, 0.3),
      maxLife: 0.3,
      color: 'rgba(245, 205, 132, 0.8)',
      size: rand(10, 18),
      type: 'trail'
    });
  }

  updateParticles(dt) {
    this.particles.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.type === 'trail' ? 0 : 28 * dt;
      if (particle.type === 'trail') particle.vx *= 0.94;
    });
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  getPlayerScreenPosition() {
    const roadWidth = this.width * 0.92;
    const x = this.width / 2 + (this.player.lane - 1) * roadWidth * 0.12;
    const y = this.playerBaseY - this.player.jumpY * 4;
    return { x, y };
  }

  project(lane, z, heightOffset = 0) {
    const ratio = clamp(1 - z / CONFIG.drawDistance, 0, 1);
    const eased = Math.pow(ratio, 1.28);
    const roadWidth = lerp(this.width * 0.18, this.width * 0.92, eased);
    const x = this.width / 2 + (lane - 1) * roadWidth * 0.24;
    const y = lerp(this.horizonY, this.playerBaseY, Math.pow(ratio, 1.62)) - heightOffset;
    const scale = lerp(0.16, 1.22, Math.pow(ratio, 1.42));
    return { x, y, scale, ratio, roadWidth };
  }

  projectSide(side, z) {
    const base = this.project(1, z, 0);
    return {
      ...base,
      x: this.width / 2 + side * base.roadWidth * 0.63
    };
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    const shakeX = this.cameraShake > 0 ? rand(-9, 9) * this.cameraShake : 0;
    const shakeY = this.cameraShake > 0 ? rand(-5, 5) * this.cameraShake : 0;
    ctx.translate(shakeX, shakeY);

    this.drawBackground();
    this.drawRoad();
    this.drawSideRuins();
    this.drawElephant();

    const renderables = [
      ...this.collectibles.map((item) => ({ ...item, category: 'collectible' })),
      ...this.obstacles.map((item) => ({ ...item, category: 'obstacle' }))
    ].sort((a, b) => b.z - a.z);

    renderables.forEach((item) => {
      if (item.category === 'collectible') this.drawCollectible(item);
      else this.drawObstacle(item);
    });

    this.drawPlayer();
    this.drawParticles();
    this.drawFogOverlay();

    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 96, 76, ${this.hitFlash * 0.18})`;
      ctx.fillRect(-20, -20, this.width + 40, this.height + 40);
    }
    ctx.restore();
  }

  drawBackground() {
    const ctx = this.ctx;
    const envA = CONFIG.environments[this.environmentIndex];
    const envB = CONFIG.environments[this.nextEnvironmentIndex];
    const blend = this.environmentClock > 17 ? this.environmentBlend : 0;

    const sky = ctx.createLinearGradient(0, 0, 0, this.height);
    sky.addColorStop(0, mixHex(envA.skyTop, envB.skyTop, blend));
    sky.addColorStop(0.46, mixHex(envA.skyBottom, envB.skyBottom, blend));
    sky.addColorStop(1, mixHex(envA.sand2, envB.sand2, blend));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.height);

    const sunX = this.width * 0.8;
    const sunY = this.height * 0.17;
    const sunR = this.width * 0.09;
    const halo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, sunR * 2.8);
    halo.addColorStop(0, 'rgba(255, 227, 159, 0.68)');
    halo.addColorStop(0.4, 'rgba(255, 210, 120, 0.18)');
    halo.addColorStop(1, 'rgba(255, 210, 120, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = mixHex(envA.sun, envB.sun, blend);
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    this.drawScenery(envA, 1 - blend);
    if (blend > 0) this.drawScenery(envB, blend);
    this.drawSpeedLines();
  }

  drawScenery(env, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = env.sand1;
    for (let i = 0; i < 4; i += 1) {
      const y = this.horizonY + i * 24;
      ctx.beginPath();
      ctx.moveTo(-40, y + 50);
      ctx.quadraticCurveTo(this.width * 0.22, y - 18, this.width * 0.5, y + 14);
      ctx.quadraticCurveTo(this.width * 0.82, y + 48, this.width + 60, y + 8);
      ctx.lineTo(this.width + 80, this.height);
      ctx.lineTo(-80, this.height);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = env.ruin;
    const silhouettes = env.key === 'eljem'
      ? [0.14, 0.24, 0.34, 0.64, 0.76]
      : [0.12, 0.22, 0.62, 0.74, 0.84];
    silhouettes.forEach((pos, index) => {
      const x = this.width * pos;
      const height = env.key === 'eljem' ? 58 + (index % 2) * 18 : 44 + (index % 3) * 16;
      ctx.fillRect(x, this.horizonY + 18, 16, height);
      ctx.fillRect(x - 6, this.horizonY + 10, 28, 10);
      if (env.key !== 'sahara') ctx.fillRect(x + 4, this.horizonY + 30, 8, 10);
    });

    if (env.key === 'byrsa') {
      ctx.fillStyle = 'rgba(59, 89, 126, 0.45)';
      ctx.fillRect(0, this.horizonY + 54, this.width, 14);
    }

    ctx.restore();
  }

  drawRoad() {
    const ctx = this.ctx;
    const roadTopY = this.horizonY + 8;
    const segCount = 26;

    ctx.fillStyle = 'rgba(40, 24, 14, 0.22)';
    ctx.beginPath();
    ctx.moveTo(this.width * 0.14, this.height);
    ctx.lineTo(this.width * 0.32, roadTopY);
    ctx.lineTo(this.width * 0.68, roadTopY);
    ctx.lineTo(this.width * 0.86, this.height);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < segCount; i += 1) {
      const t0 = i / segCount;
      const t1 = (i + 1) / segCount;
      const y0 = lerp(roadTopY, this.height, Math.pow(t0, 1.45));
      const y1 = lerp(roadTopY, this.height, Math.pow(t1, 1.45));
      const w0 = lerp(this.width * 0.18, this.width * 0.92, Math.pow(t0, 1.16));
      const w1 = lerp(this.width * 0.18, this.width * 0.92, Math.pow(t1, 1.16));
      const color = i % 2 === 0 ? '#806348' : '#73573f';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(this.width / 2 - w0 / 2, y0);
      ctx.lineTo(this.width / 2 + w0 / 2, y0);
      ctx.lineTo(this.width / 2 + w1 / 2, y1);
      ctx.lineTo(this.width / 2 - w1 / 2, y1);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 231, 190, 0.08)';
      ctx.lineWidth = Math.max(1, w1 * 0.005);
      ctx.beginPath();
      ctx.moveTo(this.width / 2 - w0 * 0.18, y0);
      ctx.lineTo(this.width / 2 + w1 * 0.16, y1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.width / 2 + w0 * 0.22, y0 + 1);
      ctx.lineTo(this.width / 2 - w1 * 0.12, y1);
      ctx.stroke();

      if (i % 3 === 0) {
        ctx.strokeStyle = 'rgba(94, 125, 66, 0.24)';
        ctx.beginPath();
        ctx.moveTo(this.width / 2 - w0 * 0.44, y0 + 2);
        ctx.lineTo(this.width / 2 - w1 * 0.37, y1 - 2);
        ctx.stroke();
      }
    }

    for (let i = 0; i < 2; i += 1) {
      const laneFactor = (i + 1) / 3;
      ctx.strokeStyle = 'rgba(255, 237, 196, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.width / 2 - this.width * 0.09 + this.width * 0.18 * laneFactor, roadTopY);
      ctx.lineTo(this.width / 2 - this.width * 0.46 + this.width * 0.92 * laneFactor, this.height);
      ctx.stroke();
    }

    const stripeOffset = (this.distance * 18) % 78;
    for (let i = -1; i < 9; i += 1) {
      const y = this.height - (i * 78 + stripeOffset);
      const depth = clamp((this.height - y) / (this.height - roadTopY), 0, 1);
      const w = lerp(7, 52, depth);
      const h = lerp(3, 24, depth);
      ctx.fillStyle = 'rgba(255, 224, 146, 0.18)';
      ctx.fillRect(this.width / 2 - w / 2, y, w, h);
    }
  }

  drawSideRuins() {
    const ctx = this.ctx;
    for (let z = 96; z >= 10; z -= 10) {
      [-1, 1].forEach((side) => {
        const pos = this.projectSide(side, z);
        const seed = Math.floor(z * (side === -1 ? 1.7 : 2.3));
        const variant = noise(seed);
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.scale(pos.scale, pos.scale);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.beginPath();
        ctx.ellipse(0, 8, 22, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        if (variant > 0.58) {
          ctx.fillStyle = '#cfbb9b';
          ctx.fillRect(-10, -46, 20, 54);
          ctx.fillRect(-16, -52, 32, 10);
          ctx.fillRect(-18, 2, 36, 8);
          ctx.strokeStyle = 'rgba(122, 96, 62, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-5, -44);
          ctx.lineTo(-5, 2);
          ctx.moveTo(5, -44);
          ctx.lineTo(5, 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#b1936b';
          ctx.fillRect(-18, -18, 36, 26);
          ctx.fillStyle = '#8f6f47';
          ctx.fillRect(-24, 4, 48, 8);
          ctx.fillStyle = '#7b8b53';
          ctx.fillRect(-10, -8, 8, 6);
          ctx.fillRect(4, -2, 10, 6);
        }
        ctx.restore();
      });
    }
  }

  drawElephant() {
    const ctx = this.ctx;
    const x = this.width * 0.17;
    const y = this.height * 0.46 + Math.sin(this.elephant.idlePhase) * 4;
    const trunkLift = easeOutCubic(this.elephant.throwAnim);
    const earSwing = Math.sin(this.elephant.earFlap) * 0.18;

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(4, 56, 60, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#9c8268';
    ctx.beginPath();
    ctx.ellipse(0, 10, 48, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(18, 4);
    ctx.rotate(-0.3 + earSwing);
    ctx.fillStyle = '#ad9275';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 15, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#a88c73';
    ctx.beginPath();
    ctx.ellipse(38, 6, 20, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7a2f1d';
    ctx.fillRect(-10, -10, 36, 18);
    ctx.fillStyle = '#e3c07a';
    ctx.fillRect(-10, -10, 36, 4);
    ctx.fillRect(-10, 4, 36, 4);

    ctx.strokeStyle = '#a88c73';
    ctx.lineCap = 'round';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(46, 10);
    ctx.quadraticCurveTo(74, -12 - trunkLift * 28, 80 + trunkLift * 8, 14 - trunkLift * 24);
    ctx.stroke();

    ctx.strokeStyle = '#f5e4c3';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(40, 15);
    ctx.lineTo(51, 30);
    ctx.moveTo(48, 14);
    ctx.lineTo(60, 28);
    ctx.stroke();

    ctx.fillStyle = '#6f5845';
    [-26, -8, 18, 34].forEach((legX) => ctx.fillRect(legX, 24, 10, 34));

    ctx.fillStyle = '#20150d';
    ctx.beginPath();
    ctx.arc(44, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCollectible(item) {
    const ctx = this.ctx;
    const landing = this.project(item.lane, item.z, 0);
    let x = landing.x;
    let y = landing.y - 20 * landing.scale;
    let scale = landing.scale;

    if (item.airborne) {
      const t = easeInOutSine(item.throwT);
      const startX = this.width * 0.22;
      const startY = this.height * 0.42;
      const arc = Math.sin(Math.PI * t) * this.height * 0.14;
      x = lerp(startX, landing.x, t);
      y = lerp(startY, landing.y - 20, t) - arc;
      scale = lerp(0.45, landing.scale, t);
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(Math.sin(item.wobble) * 0.12);

    if (item.type === 'coin') {
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
      glow.addColorStop(0, 'rgba(255, 227, 136, 0.72)');
      glow.addColorStop(1, 'rgba(255, 227, 136, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd257';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff0b5';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#ad7216';
      ctx.fillRect(-3, -7, 6, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-5, -5, 3, 10);
    } else {
      const relicColor = item.powerType === 'shield' ? '#79e29a' : '#79c8ff';
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
      glow.addColorStop(0, `${relicColor}cc`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = relicColor;
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(12, -2);
      ctx.lineTo(8, 12);
      ctx.lineTo(-8, 12);
      ctx.lineTo(-12, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#17212a';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.powerType === 'shield' ? 'S' : 'M', 0, 1);
    }
    ctx.restore();
  }

  drawObstacle(item) {
    const ctx = this.ctx;
    const pos = this.project(item.lane, item.z, 0);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(pos.scale, pos.scale);

    if (item.type === 'crate') {
      ctx.fillStyle = '#8b6747';
      ctx.fillRect(-21, -30, 42, 42);
      ctx.strokeStyle = '#d8b079';
      ctx.lineWidth = 3;
      ctx.strokeRect(-21, -30, 42, 42);
      ctx.beginPath();
      ctx.moveTo(-21, -30);
      ctx.lineTo(21, 12);
      ctx.moveTo(21, -30);
      ctx.lineTo(-21, 12);
      ctx.stroke();
    } else if (item.type === 'low') {
      ctx.fillStyle = '#7d6550';
      ctx.fillRect(-30, -14, 60, 18);
      ctx.fillStyle = '#ccb089';
      ctx.fillRect(-32, -18, 64, 6);
      ctx.fillStyle = '#7f8851';
      ctx.fillRect(-10, -18, 12, 6);
    } else {
      ctx.fillStyle = '#bba17b';
      ctx.fillRect(-34, -52, 12, 58);
      ctx.fillRect(22, -52, 12, 58);
      ctx.fillRect(-40, -54, 80, 12);
      ctx.strokeStyle = '#8d6c45';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-28, -16);
      ctx.lineTo(-28, 4);
      ctx.moveTo(28, -16);
      ctx.lineTo(28, 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPlayer() {
    const ctx = this.ctx;
    const pos = this.getPlayerScreenPosition();
    const slide = this.player.isSliding;
    const run = this.player.runCycle;
    const bob = Math.sin(run * 1.6) * (slide ? 1.2 : 3.4) - this.player.impactPulse * 3;
    const legSwing = Math.sin(run) * (slide ? 0.2 : 0.75);
    const armSwing = Math.sin(run + Math.PI) * (slide ? 0.15 : 0.72);

    ctx.save();
    ctx.translate(pos.x, pos.y + bob);
    if (slide) {
      ctx.rotate(-0.16);
      ctx.scale(1.16, 0.76);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.player.jumpGlow > 0 || this.activePower) {
      const glow = ctx.createRadialGradient(0, -20, 8, 0, -20, 44);
      const powerColor = this.activePower === 'shield'
        ? 'rgba(121, 226, 154, 0.45)'
        : this.activePower === 'magnet'
          ? 'rgba(121, 200, 255, 0.42)'
          : `rgba(255, 232, 167, ${0.34 * this.player.jumpGlow})`;
      glow.addColorStop(0, powerColor);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -20, 44, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#6c4125';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(-12 - armSwing * 10, 10 + Math.abs(armSwing) * 6);
    ctx.moveTo(6, -8);
    ctx.lineTo(12 + armSwing * 10, 8 + Math.abs(armSwing) * 6);
    ctx.moveTo(-5, 2);
    ctx.lineTo(-10 + legSwing * 10, 28);
    ctx.moveTo(5, 2);
    ctx.lineTo(10 - legSwing * 10, 28);
    ctx.stroke();

    ctx.fillStyle = '#d8c2a6';
    ctx.beginPath();
    ctx.arc(0, -44, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f0c96b';
    ctx.beginPath();
    ctx.arc(0, -54, 10, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-10, -54, 20, 4);

    ctx.fillStyle = '#b4472f';
    ctx.beginPath();
    ctx.moveTo(-17, -34);
    ctx.lineTo(17, -34);
    ctx.lineTo(12, 4);
    ctx.lineTo(-12, 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f0c96b';
    ctx.fillRect(-15, -36, 30, 7);
    ctx.fillRect(-14, -10, 28, 5);

    ctx.fillStyle = '#7a2f1d';
    ctx.beginPath();
    ctx.moveTo(-12, -28);
    ctx.lineTo(-22, -6);
    ctx.lineTo(-10, -6);
    ctx.closePath();
    ctx.fill();

    if (this.activePower === 'shield') {
      ctx.strokeStyle = 'rgba(124, 231, 144, 0.82)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -20, 34, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.activePower === 'magnet') {
      ctx.strokeStyle = 'rgba(121, 200, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-8, -20, 18, Math.PI * 0.22, Math.PI * 1.78);
      ctx.arc(8, -20, 18, Math.PI * 1.22, Math.PI * 0.78, true);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const particle of this.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha * (particle.type === 'trail' ? 0.42 : 0.8);
      if (particle.type === 'trail') {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.ellipse(particle.x, particle.y, particle.size * 1.3 * alpha, particle.size * 0.5 * alpha, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawSpeedLines() {
    const ctx = this.ctx;
    const intensity = mapRange(this.speed, CONFIG.baseSpeed, CONFIG.maxSpeed, 0.12, 0.42);
    ctx.save();
    ctx.strokeStyle = `rgba(255, 232, 173, ${intensity * 0.5})`;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 16; i += 1) {
      const y = (i * 48 + (this.distance * 14) % 48) % (this.height + 50);
      ctx.beginPath();
      ctx.moveTo(this.width * 0.08, y);
      ctx.lineTo(this.width * 0.18, y + 20);
      ctx.moveTo(this.width * 0.92, y);
      ctx.lineTo(this.width * 0.82, y + 20);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFogOverlay() {
    const ctx = this.ctx;
    const fog = ctx.createLinearGradient(0, this.horizonY - 10, 0, this.horizonY + 120);
    fog.addColorStop(0, 'rgba(255, 219, 162, 0.18)');
    fog.addColorStop(1, 'rgba(255, 219, 162, 0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, this.horizonY - 10, this.width, 130);
  }
}
