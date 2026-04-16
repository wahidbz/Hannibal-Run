export class ElephantEntity {
  constructor(config) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.coinTimer = this.config.coinTimer();
    this.powerTimer = this.config.powerTimer();
    this.throwAnim = 0;
    this.idlePhase = 0;
    this.earFlap = 0;
  }

  update(dt) {
    this.coinTimer -= dt;
    this.powerTimer -= dt;
    this.throwAnim = Math.max(0, this.throwAnim - dt * 1.7);
    this.idlePhase += dt * 2.2;
    this.earFlap += dt * 4.1;
  }

  triggerThrow() {
    this.throwAnim = 1;
  }
}
