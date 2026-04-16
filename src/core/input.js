import { CONFIG } from './config.js';

export class InputController {
  constructor(target, onAction, callbacks = {}) {
    this.target = target;
    this.onAction = onAction;
    this.callbacks = callbacks;
    this.touchStart = null;
    this.motionBound = false;
    this.motionState = 'idle';
    this.filteredGamma = 0;
    this.lastTiltAt = 0;
    this.lastTiltDir = null;
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onOrientation = this.onOrientation.bind(this);
  }

  attach() {
    this.target.addEventListener('touchstart', this.onTouchStart, { passive: true });
    this.target.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);
    this.setMotionState(window.DeviceOrientationEvent ? 'request' : 'unsupported');
    if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
      this.bindMotion();
    }
  }

  onTouchStart(event) {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    this.touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }

  onTouchEnd(event) {
    const touch = event.changedTouches?.[0];
    if (!touch || !this.touchStart) return;
    const dx = touch.clientX - this.touchStart.x;
    const dy = touch.clientY - this.touchStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const quickEnough = Date.now() - this.touchStart.time < 700;
    this.touchStart = null;
    if (!quickEnough) return;
    if (absX < 28 && absY < 28) return;
    if (absY > absX) this.onAction(dy < 0 ? 'jump' : 'slide');
    else this.onAction(dx < 0 ? 'left' : 'right');
  }

  onKeyDown(event) {
    const keyMap = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'jump',
      ArrowDown: 'slide',
      a: 'left',
      d: 'right',
      w: 'jump',
      s: 'slide'
    };
    const action = keyMap[event.key];
    if (action) {
      event.preventDefault();
      this.onAction(action);
    }
  }

  async primeMotion() {
    if (!window.DeviceOrientationEvent) {
      this.setMotionState('unsupported');
      return false;
    }

    try {
      if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
        const result = await window.DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') {
          this.setMotionState('denied');
          return false;
        }
      }
      this.bindMotion();
      this.setMotionState('ready');
      return true;
    } catch (error) {
      console.warn('Motion permission unavailable', error);
      this.setMotionState('unsupported');
      return false;
    }
  }

  bindMotion() {
    if (this.motionBound) return;
    this.motionBound = true;
    window.addEventListener('deviceorientation', this.onOrientation, true);
  }

  onOrientation(event) {
    if (typeof event.gamma !== 'number') return;
    this.filteredGamma = this.filteredGamma * 0.78 + event.gamma * 0.22;
    const now = Date.now();
    const absGamma = Math.abs(this.filteredGamma);
    if (absGamma < CONFIG.tiltDeadZone) {
      this.lastTiltDir = null;
      return;
    }
    if (absGamma < CONFIG.tiltThreshold) return;
    if (now - this.lastTiltAt < CONFIG.tiltCooldown) return;

    const dir = this.filteredGamma < 0 ? 'left' : 'right';
    if (dir === this.lastTiltDir) return;
    this.lastTiltDir = dir;
    this.lastTiltAt = now;
    this.onAction(dir);
  }

  setMotionState(state) {
    this.motionState = state;
    this.callbacks.onMotionStateChange?.(state);
  }

  getMotionState() {
    return this.motionState;
  }
}
