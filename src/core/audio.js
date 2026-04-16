const NOTE = {
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33
};

export class AudioManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.fxGain = null;
    this.musicStarted = false;
    this.scheduleHandle = null;
    this.nextNoteTime = 0;
    this.barStep = 0;
    this.tempo = 96;
    this.melody = [NOTE.D4, NOTE.F4, NOTE.G4, NOTE.A4, NOTE.G4, NOTE.F4, NOTE.D4, NOTE.C4];
  }

  get audioContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.82;
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.fxGain = this.ctx.createGain();
      this.fxGain.gain.value = 0.36;
      this.musicGain.connect(this.master);
      this.fxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) this.master.gain.setTargetAtTime(enabled ? 0.82 : 0.0001, this.audioContext.currentTime, 0.08);
    if (!enabled) this.stopMusic();
  }

  async resume() {
    const ctx = this.audioContext;
    if (!ctx) return;
    if (ctx.state !== 'running') await ctx.resume();
  }

  createVoice(type, frequency, start, duration, gainValue = 0.1, filterFreq = 1800) {
    const ctx = this.audioContext;
    if (!ctx || !this.enabled) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, start);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  createNoise(start, duration, gainValue, destination = this.fxGain) {
    const ctx = this.audioContext;
    if (!ctx || !this.enabled) return null;
    const buffer = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.6;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    gain.gain.setValueAtTime(gainValue, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.start(start);
    source.stop(start + duration + 0.02);
    return { source, gain };
  }

  startMusic() {
    if (!this.enabled || this.musicStarted || !this.audioContext) return;
    this.musicStarted = true;
    this.nextNoteTime = this.audioContext.currentTime + 0.04;
    this.barStep = 0;
    this.scheduler();
  }

  scheduler() {
    if (!this.musicStarted || !this.enabled) return;
    const ctx = this.audioContext;
    const stepDur = 60 / this.tempo / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      this.scheduleStep(this.barStep, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.barStep = (this.barStep + 1) % 16;
    }
    this.scheduleHandle = window.setTimeout(() => this.scheduler(), 60);
  }

  scheduleStep(step, time, stepDur) {
    const bassPattern = [NOTE.D4 / 2, NOTE.D4 / 2, NOTE.C4 / 2, NOTE.D4 / 2];
    const bass = bassPattern[Math.floor(step / 4)] || NOTE.D4 / 2;
    if (step % 4 === 0) this.createVoice('triangle', bass, time, stepDur * 1.7, 0.13, 900);
    if (step % 2 === 0) this.createVoice('sine', NOTE.D4 / 4, time, stepDur * 1.9, 0.04, 420);
    if ([1, 3, 5, 7, 9, 11, 13, 15].includes(step)) {
      this.createVoice('triangle', this.melody[step % this.melody.length], time, stepDur * 1.2, 0.07, 1500);
    }
    if (step % 4 === 0) this.createNoise(time, 0.06, 0.018, this.musicGain);
    if (step % 8 === 4) this.createNoise(time, 0.1, 0.012, this.musicGain);
  }

  stopMusic() {
    this.musicStarted = false;
    if (this.scheduleHandle) {
      window.clearTimeout(this.scheduleHandle);
      this.scheduleHandle = null;
    }
  }

  beep(type, frequency, duration, volume = 0.18, sweepTo = null) {
    const ctx = this.audioContext;
    if (!ctx || !this.enabled) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.fxGain);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.03);
  }

  jump() {
    this.beep('triangle', 330, 0.18, 0.16, 520);
    this.createNoise(this.audioContext.currentTime, 0.05, 0.012);
  }

  slide() {
    this.beep('sawtooth', 180, 0.16, 0.11, 110);
    this.createNoise(this.audioContext.currentTime, 0.09, 0.018);
  }

  coin() {
    this.beep('sine', 780, 0.08, 0.16, 1040);
    this.beep('triangle', 1040, 0.09, 0.08, 1320);
  }

  hit() {
    this.beep('sawtooth', 130, 0.28, 0.2, 70);
    this.createNoise(this.audioContext.currentTime, 0.16, 0.04);
  }

  power() {
    this.beep('triangle', 440, 0.18, 0.13, 620);
    this.beep('sine', 620, 0.22, 0.08, 880);
  }

  uiTap() {
    this.beep('sine', 520, 0.07, 0.07, 640);
  }
}
