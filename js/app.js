/**
 * AeroFlow Lab - Professional Aerodynamics Workstation & Canvas Engine
 */

import { AerodynamicSolver } from './physics.js';
import { AeroAcoustics } from './audio.js';

class App {
  constructor() {
    this.canvas = document.getElementById('wind-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    this.chartCanvas = document.getElementById('polar-chart');
    this.chartCtx = this.chartCanvas ? this.chartCanvas.getContext('2d') : null;

    // Numerical solver
    this.solver = new AerodynamicSolver(200, 100);
    this.acoustics = new AeroAcoustics();

    this.isRunning = true;
    this.viewMode = 'smoke'; // 'smoke', 'pressure', 'vorticity', 'schlieren', 'vectors'
    this.isDraggingObstacle = false;
    this.isDraggingPitchHandle = false;
    this.isMouseDown = false;

    // Offscreen buffer for fast pixel rendering of fields
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = this.solver.nx;
    this.offscreenCanvas.height = this.solver.ny;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    this.imgData = this.offscreenCtx.createImageData(this.solver.nx, this.solver.ny);

    // Surface wool tufts for boundary layer flow visualization
    this.tufts = [];
    this.initTufts();

    // Telemetry history for mini-chart
    this.clHistory = new Array(70).fill(0);
    this.cdHistory = new Array(70).fill(0);

    // Frame timing & FPS
    this.fps = 60;
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    this.initCanvasSize();
    this.bindEvents();
    this.updateUI();

    // Start render loop
    requestAnimationFrame((t) => this.loop(t));
  }

  initTufts() {
    this.tufts = [];
    for (let i = 0; i < 8; i++) {
      this.tufts.push({
        s: 0.12 + i * 0.11, // position along chord (0 to 1)
        angle: 0,
        flutter: 0
      });
    }
  }

  initCanvasSize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    if (this.chartCanvas) {
      this.chartCanvas.width = this.chartCanvas.clientWidth || 280;
      this.chartCanvas.height = 64;
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.initCanvasSize();
    });

    // Geometry Preset buttons
    const geomBtns = document.querySelectorAll('.btn-geom');
    geomBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        geomBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.dataset.preset;
        this.selectPreset(preset);
      });
    });

    // View Mode Switcher Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewMode = btn.dataset.mode;
      });
    });

    // Angle of Attack slider
    const aoaSlider = document.getElementById('slider-aoa');
    const aoaVal = document.getElementById('val-aoa');
    if (aoaSlider) {
      aoaSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (aoaVal) aoaVal.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}°`;
        this.solver.setAngle(val);
        this.updateWatermark();
      });
    }

    // Velocity slider
    const velSlider = document.getElementById('slider-velocity');
    const velVal = document.getElementById('val-velocity');
    if (velSlider) {
      velSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const speedMs = val * 24.0;
        if (velVal) velVal.textContent = `${speedMs.toFixed(1)} m/s`;
        this.solver.setInflow(val);
        this.updateWatermark();
      });
    }

    // Viscosity slider
    const viscSlider = document.getElementById('slider-visc');
    const viscVal = document.getElementById('val-visc');
    if (viscSlider) {
      viscSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (viscVal) viscVal.textContent = val.toExponential(1);
        this.solver.setViscosity(val);
      });
    }

    // Vorticity confinement slider
    const vcSlider = document.getElementById('slider-vort');
    const vcVal = document.getElementById('val-vort');
    if (vcSlider) {
      vcSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (vcVal) vcVal.textContent = val.toFixed(2);
        this.solver.setVorticityConfinement(val);
      });
    }

    // Pause button
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        this.isRunning = !this.isRunning;
        btnPause.innerHTML = this.isRunning
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`
          : `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Resume`;
      });
    }

    // Audio button
    const btnAudio = document.getElementById('btn-audio');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const active = this.acoustics.toggleMute();
        btnAudio.classList.toggle('audio-on', active);
        btnAudio.innerHTML = active
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Acoustics On`
          : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg> Acoustics Off`;
      });
    }

    // Reset flow button
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.solver.resetFlow();
      });
    }

    // Snapshot button
    const btnSnapshot = document.getElementById('btn-snapshot');
    if (btnSnapshot) {
      btnSnapshot.addEventListener('click', () => {
        this.exportSnapshot();
      });
    }

    // Direct Canvas Manipulation
    const getGridPos = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * this.solver.nx;
      const y = ((clientY - rect.top) / rect.height) * this.solver.ny;
      return { x, y };
    };

    this.canvas.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      const pos = getGridPos(e.clientX, e.clientY);

      if (this.solver.obstacleType === 'custom') {
        const isRightClick = e.button === 2;
        this.solver.paintSolidCircle(pos.x, pos.y, 4.0, !isRightClick);
        return;
      }

      // Check if clicking near the trailing edge handle to rotate AoA
      const rad = (this.solver.angleDegrees * Math.PI) / 180.0;
      const hx = this.solver.obstacleX + Math.cos(rad) * this.solver.chordLength;
      const hy = this.solver.obstacleY + Math.sin(rad) * this.solver.chordLength;
      const distHandle = Math.hypot(pos.x - hx, pos.y - hy);

      if (distHandle < 8.0) {
        this.isDraggingPitchHandle = true;
        return;
      }

      // Otherwise check if dragging obstacle body
      const distBody = Math.hypot(pos.x - this.solver.obstacleX, pos.y - this.solver.obstacleY);
      if (distBody < this.solver.chordLength * 0.75) {
        this.isDraggingObstacle = true;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      this.isDraggingObstacle = false;
      this.isDraggingPitchHandle = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const pos = getGridPos(e.clientX, e.clientY);

      if (this.isMouseDown && this.solver.obstacleType === 'custom') {
        const isRightClick = e.buttons === 2;
        this.solver.paintSolidCircle(pos.x, pos.y, 4.0, !isRightClick);
      } else if (this.isDraggingPitchHandle) {
        const dx = pos.x - this.solver.obstacleX;
        const dy = pos.y - this.solver.obstacleY;
        const angleRad = Math.atan2(dy, dx);
        let angleDeg = (angleRad * 180.0) / Math.PI;
        angleDeg = Math.max(-25, Math.min(25, angleDeg));

        this.solver.setAngle(angleDeg);
        const aoaSlider = document.getElementById('slider-aoa');
        const aoaVal = document.getElementById('val-aoa');
        if (aoaSlider) aoaSlider.value = angleDeg.toFixed(1);
        if (aoaVal) aoaVal.textContent = `${angleDeg > 0 ? '+' : ''}${angleDeg.toFixed(1)}°`;
        this.updateWatermark();
      } else if (this.isDraggingObstacle) {
        this.solver.obstacleX = Math.max(12, Math.min(this.solver.nx - 45, Math.round(pos.x)));
        this.solver.obstacleY = Math.max(12, Math.min(this.solver.ny - 12, Math.round(pos.y)));
        this.solver.rebuildObstacle();
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.isMouseDown = true;
        const pos = getGridPos(e.touches[0].clientX, e.touches[0].clientY);
        if (this.solver.obstacleType === 'custom') {
          this.solver.paintSolidCircle(pos.x, pos.y, 4.0, true);
        } else {
          this.isDraggingObstacle = true;
        }
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const pos = getGridPos(e.touches[0].clientX, e.touches[0].clientY);
        if (this.solver.obstacleType === 'custom') {
          this.solver.paintSolidCircle(pos.x, pos.y, 4.0, true);
        } else if (this.isDraggingObstacle) {
          this.solver.obstacleX = Math.max(12, Math.min(this.solver.nx - 45, Math.round(pos.x)));
          this.solver.obstacleY = Math.max(12, Math.min(this.solver.ny - 12, Math.round(pos.y)));
          this.solver.rebuildObstacle();
        }
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.isMouseDown = false;
      this.isDraggingObstacle = false;
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        btnPause?.click();
      } else if (e.code === 'KeyM') {
        btnAudio?.click();
      } else if (e.code === 'KeyR') {
        this.solver.resetFlow();
      } else if (e.code === 'KeyC') {
        this.solver.clearSolid();
        this.selectPreset('custom');
      }
    });
  }

  selectPreset(preset) {
    this.solver.obstacleType = preset;
    if (preset !== 'custom') {
      this.solver.rebuildObstacle();
      this.solver.resetFlow();
    }
    this.updateWatermark();
  }

  updateWatermark() {
    const names = {
      naca0012: 'NACA 0012',
      cambered: 'NACA 4412',
      cylinder: 'Circular Cylinder',
      f1wing: 'F1 Rear Wing',
      wedge: 'Supersonic Wedge',
      flatplate: 'Flat Plate',
      custom: 'Custom Pen'
    };

    const bModel = document.getElementById('badge-model');
    if (bModel) bModel.textContent = names[this.solver.obstacleType] || this.solver.obstacleType;

    const bAoa = document.getElementById('badge-aoa');
    if (bAoa) bAoa.textContent = `${this.solver.angleDegrees > 0 ? '+' : ''}${this.solver.angleDegrees.toFixed(1)}°`;

    const bSpeed = document.getElementById('badge-speed');
    if (bSpeed) bSpeed.textContent = `${(this.solver.inflowVelocity * 24.0).toFixed(1)} m/s`;
  }

  exportSnapshot() {
    const link = document.createElement('a');
    link.download = `aeroflow_${this.solver.obstacleType}_${Date.now()}.png`;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }

  updateUI() {
    const s = this.solver;

    // Telemetry Table updates
    const clEl = document.getElementById('hud-cl');
    if (clEl) clEl.textContent = s.cl.toFixed(3);

    const cdEl = document.getElementById('hud-cd');
    if (cdEl) cdEl.textContent = s.cd.toFixed(3);

    const ldEl = document.getElementById('hud-ld');
    if (ldEl) ldEl.textContent = s.ldRatio.toFixed(1);

    const reEl = document.getElementById('hud-re');
    if (reEl) reEl.textContent = s.reynolds.toLocaleString();

    const machEl = document.getElementById('hud-mach');
    if (machEl) {
      const mach = (s.inflowVelocity * 24.0) / 340.0;
      machEl.textContent = `M ${mach.toFixed(2)}`;
    }

    const shedEl = document.getElementById('hud-shed');
    if (shedEl) shedEl.textContent = `${s.vortexSheddingFreq.toFixed(0)} Hz`;

    // Stall Badge
    const stallEl = document.getElementById('flow-state-badge');
    if (stallEl) {
      if (s.isStalled) {
        stallEl.textContent = 'BOUNDARY SEPARATION / STALL';
        stallEl.className = 'flow-state-badge stalled';
      } else {
        stallEl.textContent = 'ATTACHED LAMINAR FLOW';
        stallEl.className = 'flow-state-badge';
      }
    }

    // Status bar FPS
    const fpsEl = document.getElementById('status-fps');
    if (fpsEl) fpsEl.textContent = `${this.fps}`;

    // Push history for chart
    this.clHistory.shift();
    this.clHistory.push(Math.max(-2, Math.min(3, s.cl)));

    this.cdHistory.shift();
    this.cdHistory.push(Math.max(0, Math.min(2, s.cd)));

    this.renderMiniChart();
  }

  renderMiniChart() {
    if (!this.chartCtx) return;
    const ctx = this.chartCtx;
    const w = this.chartCanvas.width;
    const h = this.chartCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Subtle grid lines
    ctx.strokeStyle = '#262830';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    // Plot CL (Muted green line)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const len = this.clHistory.length;
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * w;
      const y = h * 0.5 - this.clHistory[i] * 18;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Plot CD (Amber line)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * w;
      const y = h * 0.5 - this.cdHistory[i] * 18;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  loop(timestamp) {
    this.frameCount++;
    if (timestamp - this.fpsTimer >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / (timestamp - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = timestamp;
      this.updateUI();
    }

    if (this.isRunning) {
      this.solver.step();
      this.acoustics.update(this.solver);
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  render() {
    const s = this.solver;
    const nx = s.nx;
    const ny = s.ny;
    const data = this.imgData.data;

    // Authentic scientific colormaps
    if (this.viewMode === 'pressure') {
      // Diverging Bernoulli Pressure Colormap (Deep blue -> neutral dark slate -> crimson)
      for (let k = 0; k < s.size; k++) {
        const pIdx = k * 4;
        if (s.solid[k]) {
          data[pIdx] = 30;
          data[pIdx + 1] = 32;
          data[pIdx + 2] = 38;
          data[pIdx + 3] = 255;
        } else {
          const val = s.p[k] * 35.0;
          let r = 24, g = 26, b = 32;
          if (val > 0) {
            // High pressure (warm amber/terracotta)
            r = Math.min(240, 24 + val * 210);
            g = Math.min(160, 26 + val * 90);
            b = Math.max(10, 32 - val * 20);
          } else {
            // Suction low pressure (cool oceanic slate)
            const neg = Math.abs(val);
            b = Math.min(235, 32 + neg * 200);
            g = Math.min(190, 26 + neg * 140);
            r = Math.max(10, 24 - neg * 15);
          }
          data[pIdx] = r;
          data[pIdx + 1] = g;
          data[pIdx + 2] = b;
          data[pIdx + 3] = 255;
        }
      }
    } else if (this.viewMode === 'vorticity') {
      // Vorticity Colormap: Clockwise vs Counter-Clockwise rotation
      for (let k = 0; k < s.size; k++) {
        const pIdx = k * 4;
        if (s.solid[k]) {
          data[pIdx] = 30;
          data[pIdx + 1] = 32;
          data[pIdx + 2] = 38;
          data[pIdx + 3] = 255;
        } else {
          const curl = s.vort[k] * 80.0;
          let r = 20, g = 22, b = 28;
          if (curl > 0) {
            r = Math.min(240, 20 + curl * 210);
            g = Math.min(140, 22 + curl * 70);
            b = 25;
          } else {
            const neg = Math.abs(curl);
            b = Math.min(235, 28 + neg * 200);
            g = Math.min(180, 22 + neg * 130);
            r = 20;
          }
          data[pIdx] = r;
          data[pIdx + 1] = g;
          data[pIdx + 2] = b;
          data[pIdx + 3] = 255;
        }
      }
    } else if (this.viewMode === 'schlieren') {
      // True NASA Schlieren Knife-Edge Shadowgraph simulation
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const k = i + j * nx;
          const pIdx = k * 4;
          if (s.solid[k]) {
            data[pIdx] = 20;
            data[pIdx + 1] = 22;
            data[pIdx + 2] = 26;
            data[pIdx + 3] = 255;
          } else {
            const nextI = Math.min(nx - 1, i + 1);
            const prevI = Math.max(0, i - 1);
            const dp_dx = (s.p[nextI + j * nx] - s.p[prevI + j * nx]) * 420.0;
            const intensity = Math.max(0, Math.min(255, 120 + dp_dx));
            data[pIdx] = intensity * 0.92;
            data[pIdx + 1] = intensity * 0.94;
            data[pIdx + 2] = intensity;
            data[pIdx + 3] = 255;
          }
        }
      }
    } else {
      // Realistic Wind Tunnel Smoke (Illuminated white/gray smoke against graphite background)
      for (let k = 0; k < s.size; k++) {
        const pIdx = k * 4;
        if (s.solid[k]) {
          data[pIdx] = 26;
          data[pIdx + 1] = 28;
          data[pIdx + 2] = 34;
          data[pIdx + 3] = 255;
        } else {
          const smk = Math.min(1.0, s.smoke[k]);
          const base = 18;
          // Smooth neutral smoke tone
          const val = Math.min(255, base + smk * 195);
          data[pIdx] = val;
          data[pIdx + 1] = val + smk * 5;
          data[pIdx + 2] = val + smk * 12;
          data[pIdx + 3] = 255;
        }
      }
    }

    this.offscreenCtx.putImageData(this.imgData, 0, 0);

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.offscreenCanvas, 0, 0, cw, ch);

    // Subtle background wind-tunnel honeycomb grid
    this.renderTunnelGrid(cw, ch);

    // Overlay Smoke Filaments or Vectors
    if (this.viewMode === 'smoke') {
      this.renderSmokeTracers(cw, ch);
    } else if (this.viewMode === 'vectors') {
      this.renderVelocityVectors(cw, ch);
    }

    // Direct manipulation handles, surface wool tufts, and force vectors
    this.renderObstacleOverlay(cw, ch);
  }

  renderTunnelGrid(cw, ch) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1;

    const step = 48;
    for (let x = 0; x < cw; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = 0; y < ch; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }

    // Left honeycomb inlet plate representation
    ctx.fillStyle = '#1c1e24';
    ctx.fillRect(0, 0, 6, ch);
    ctx.fillStyle = '#2d313b';
    for (let y = 8; y < ch; y += 12) {
      ctx.fillRect(1, y, 4, 2);
    }

    ctx.restore();
  }

  renderSmokeTracers(cw, ch) {
    const ctx = this.ctx;
    const scaleX = cw / this.solver.nx;
    const scaleY = ch / this.solver.ny;

    ctx.save();
    for (let k = 0; k < this.solver.tracers.length; k++) {
      const p = this.solver.tracers[k];
      const px = p.x * scaleX;
      const py = p.y * scaleY;
      const alpha = Math.max(0.15, 1.0 - (p.age / p.life));

      // Realistic illuminated white/pearl streak beads
      ctx.fillStyle = `rgba(235, 240, 255, ${alpha * 0.7})`;
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }
    ctx.restore();
  }

  renderVelocityVectors(cw, ch) {
    const ctx = this.ctx;
    const s = this.solver;
    const stepX = Math.floor(s.nx / 32);
    const stepY = Math.floor(s.ny / 18);
    const scaleX = cw / s.nx;
    const scaleY = ch / s.ny;

    ctx.strokeStyle = 'rgba(240, 244, 255, 0.4)';
    ctx.fillStyle = 'rgba(240, 244, 255, 0.6)';
    ctx.lineWidth = 1.0;

    for (let j = stepY; j < s.ny - stepY; j += stepY) {
      for (let i = stepX; i < s.nx - stepX; i += stepX) {
        const idx = s.index(i, j);
        if (s.solid[idx]) continue;

        const uVal = s.u[idx];
        const vVal = s.v[idx];
        const speed = Math.hypot(uVal, vVal);
        if (speed < 0.05) continue;

        const startX = i * scaleX;
        const startY = j * scaleY;
        const arrowLen = Math.min(20, speed * 10);
        const endX = startX + (uVal / speed) * arrowLen;
        const endY = startY + (vVal / speed) * arrowLen;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(endX, endY, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  renderObstacleOverlay(cw, ch) {
    const ctx = this.ctx;
    const s = this.solver;
    const scaleX = cw / s.nx;
    const scaleY = ch / s.ny;

    const ox = s.obstacleX * scaleX;
    const oy = s.obstacleY * scaleY;
    const chordPx = s.chordLength * scaleX;
    const rad = (s.angleDegrees * Math.PI) / 180.0;

    if (s.obstacleType !== 'custom') {
      ctx.save();

      // 1. Interactive Chord Line & Pitch Handle
      const hx = ox + Math.cos(rad) * chordPx;
      const hy = oy + Math.sin(rad) * chordPx;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Protractor Arc
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      const arcRad = Math.min(45, chordPx * 0.35);
      ctx.arc(ox, oy, arcRad, 0, rad, rad < 0);
      ctx.stroke();

      // Trailing edge pitch handle knob
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#262830';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pivot center dot
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 2. Surface Wool Tufts (Flight Test Boundary Layer Visualizer)
      if (s.obstacleType === 'naca0012' || s.obstacleType === 'cambered') {
        ctx.strokeStyle = '#f3f4f6';
        ctx.lineWidth = 1.2;

        for (let i = 0; i < this.tufts.length; i++) {
          const t = this.tufts[i];
          const distFromLead = t.s * s.chordLength;
          const tuftGridX = s.obstacleX + Math.cos(rad) * distFromLead;
          const tuftGridY = s.obstacleY + Math.sin(rad) * distFromLead - 3.5;

          const uLocal = s.sampleBilinear(s.u, tuftGridX, tuftGridY);
          const vLocal = s.sampleBilinear(s.v, tuftGridX, tuftGridY);
          const localFlowAngle = Math.atan2(vLocal, uLocal);

          // Tufts flutter violently if flow reverses or stalls
          const isReverse = uLocal < 0.2 || s.isStalled;
          const flutter = isReverse ? (Math.random() - 0.5) * 1.4 : 0;
          t.angle = localFlowAngle + flutter;

          const tx = tuftGridX * scaleX;
          const ty = tuftGridY * scaleY;
          const tuftLen = 10;
          const ex = tx + Math.cos(t.angle) * tuftLen;
          const ey = ty + Math.sin(t.angle) * tuftLen;

          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.fillStyle = isReverse ? '#ef4444' : '#10b981';
          ctx.beginPath();
          ctx.arc(tx, ty, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Clean Aerodynamic Force Vectors
      // Lift vector (Green)
      const liftPx = Math.max(-65, Math.min(65, s.cl * 32));
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox, oy - liftPx);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.font = '11px sans-serif';
      ctx.fillText(`L (${s.cl.toFixed(2)})`, ox + 6, oy - liftPx - 4);

      // Drag vector (Amber)
      const dragPx = Math.max(8, Math.min(75, s.cd * 38));
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + dragPx, oy);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`D (${s.cd.toFixed(2)})`, ox + dragPx + 6, oy + 4);

      ctx.restore();
    }
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.aeroApp = new App();
});
