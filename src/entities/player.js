import { clamp, lerp } from '../core/utils.js';

export class PlayerEntity {
  constructor(config) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.lane = 1;
    this.targetLane = 1;
    this.jumpY = 0;
    this.jumpVelocity = 0;
    this.slideTimer = 0;
    this.grounded = true;
    this.runCycle = 0;
    this.jumpGlow = 0;
    this.slideTrail = 0;
    this.impactPulse = 0;
  }

  action(action) {
    if (action === 'left') this.targetLane = clamp(this.targetLane - 1, 0, 2);
    if (action === 'right') this.targetLane = clamp(this.targetLane + 1, 0, 2);
    if (action === 'jump' && this.grounded) {
      this.jumpVelocity = this.config.jumpVelocity;
      this.grounded = false;
      this.slideTimer = 0;
      this.jumpGlow = 1;
      return 'jump';
    }
    if (action === 'slide' && this.grounded && this.slideTimer <= 0) {
      this.slideTimer = this.config.slideDuration;
      this.slideTrail = 1;
      return 'slide';
    }
    return null;
  }

  update(dt, speed) {
    this.lane = lerp(this.lane, this.targetLane, 1 - Math.exp(-this.config.laneLerp * dt));
    this.runCycle += dt * Math.max(7, speed * 0.32);
    this.jumpGlow = Math.max(0, this.jumpGlow - dt * 2.2);
    this.slideTrail = Math.max(0, this.slideTrail - dt * 2.4);
    this.impactPulse = Math.max(0, this.impactPulse - dt * 3);

    if (!this.grounded) {
      this.jumpVelocity -= this.config.gravity * dt;
      this.jumpY += this.jumpVelocity * dt * 2.25;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.jumpVelocity = 0;
        this.grounded = true;
      }
    }

    if (this.slideTimer > 0) this.slideTimer -= dt;
    else this.slideTimer = 0;
  }

  get isSliding() {
    return this.slideTimer > 0;
  }

  hit() {
    this.impactPulse = 1;
  }
}
