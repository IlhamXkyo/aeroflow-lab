/**
 * AeroFlow Lab - Procedural Aerodynamic Acoustic Synthesizer
 * Uses Web Audio API to procedurally generate wind rush,
 * Strouhal vortex shedding whistling tones, and turbulent stall rumble.
 */

export class AeroAcoustics {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.initialized = false;

    // Audio graph nodes
    this.masterGain = null;
    this.noiseNode = null;
    this.noiseFilter = null;
    this.noiseGain = null;

    // Strouhal vortex oscillator
    this.vortexOsc = null;
    this.vortexGain = null;
    this.vortexFilter = null;

    // Stall turbulence rumble
    this.stallOsc = null;
    this.stallGain = null;
    this.subFilter = null;
  }

  init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master output limiter
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // 1. Wind Rush (Algorithmic Pink Noise Generator)
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      this.noiseFilter = this.ctx.createBiquadFilter();
      this.noiseFilter.type = 'bandpass';
      this.noiseFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
      this.noiseFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.noiseNode.connect(this.noiseFilter);
      this.noiseFilter.connect(this.noiseGain);
      this.noiseGain.connect(this.masterGain);
      this.noiseNode.start();

      // 2. Strouhal Vortex Shedding Whistle
      this.vortexOsc = this.ctx.createOscillator();
      this.vortexOsc.type = 'sine';
      this.vortexOsc.frequency.setValueAtTime(160, this.ctx.currentTime);

      this.vortexFilter = this.ctx.createBiquadFilter();
      this.vortexFilter.type = 'lowpass';
      this.vortexFilter.frequency.setValueAtTime(800, this.ctx.currentTime);

      this.vortexGain = this.ctx.createGain();
      this.vortexGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.vortexOsc.connect(this.vortexFilter);
      this.vortexFilter.connect(this.vortexGain);
      this.vortexGain.connect(this.masterGain);
      this.vortexOsc.start();

      // 3. Low-Frequency Stall Turbulence Rumble
      this.stallOsc = this.ctx.createOscillator();
      this.stallOsc.type = 'triangle';
      this.stallOsc.frequency.setValueAtTime(42, this.ctx.currentTime);

      this.subFilter = this.ctx.createBiquadFilter();
      this.subFilter.type = 'lowpass';
      this.subFilter.frequency.setValueAtTime(90, this.ctx.currentTime);

      this.stallGain = this.ctx.createGain();
      this.stallGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.stallOsc.connect(this.subFilter);
      this.subFilter.connect(this.stallGain);
      this.stallGain.connect(this.masterGain);
      this.stallOsc.start();

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio initialization error:', e);
    }
  }

  toggleMute() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0.0 : 0.65;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
    }
    return !this.isMuted;
  }

  update(solver) {
    if (!this.initialized || this.isMuted || !this.ctx) return;

    const now = this.ctx.currentTime;
    const uInf = solver.inflowVelocity;

    // Wind rush filter frequency scales with inflow velocity
    const targetFreq = 220 + uInf * 280;
    this.noiseFilter.frequency.setTargetAtTime(targetFreq, now, 0.05);

    const windVol = Math.min(0.45, 0.08 + uInf * 0.12);
    this.noiseGain.gain.setTargetAtTime(windVol, now, 0.05);

    // Strouhal shedding pitch
    const sheddingPitch = Math.max(60, Math.min(520, solver.vortexSheddingFreq * 2.8));
    this.vortexOsc.frequency.setTargetAtTime(sheddingPitch, now, 0.06);

    // Whistling volume is strongest for bluff bodies (cylinders, high drag)
    const isBluff = solver.obstacleType === 'cylinder' || solver.obstacleType === 'flatplate';
    const vortexTargetVol = isBluff ? 0.18 : 0.04;
    this.vortexGain.gain.setTargetAtTime(vortexTargetVol, now, 0.08);

    // Stall buffeting rumble
    let stallVol = 0.0;
    if (solver.isStalled) {
      stallVol = Math.min(0.4, solver.stallFactor * 0.45);
      const rumblePitch = 34 + Math.sin(now * 8) * 8;
      this.stallOsc.frequency.setTargetAtTime(rumblePitch, now, 0.04);
    }
    this.stallGain.gain.setTargetAtTime(stallVol, now, 0.05);
  }
}
