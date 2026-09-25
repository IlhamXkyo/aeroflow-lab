/**
 * AeroFlow Lab - Main Interactive Application & Telemetry Canvas Engine
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
    this.drawMode = false;
    this.isDraggingObstacle = false;
    this.isMouseDown = false;
    this.dragStart = { x: 0, y: 0 };

    // Offscreen buffer for fast pixel rendering of fields
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = this.solver.nx;
    this.offscreenCanvas.height = this.solver.ny;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    this.imgData = this.offscreenCtx.createImageData(this.solver.nx, this.solver.ny);

    // Telemetry history for mini-chart
    this.clHistory = new Array(80).fill(0);
    this.cdHistory = new Array(80).fill(0);

    // Frame timing & FPS
    this.lastFrameTime = performance.now();
    this.fps = 60;
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    this.initCanvasSize();
    this.bindEvents();
    this.updateUI();

    // Start render loop
    requestAnimationFrame((t) => this.loop(t));
  }

  initCanvasSize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    if (this.chartCanvas) {
      this.chartCanvas.width = this.chartCanvas.clientWidth || 240;
      this.chartCanvas.height = 60;
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.initCanvasSize();
    });

    // Preset buttons
    const presetBtns = document.querySelectorAll('.btn-preset');
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        presetBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.dataset.preset;
        this.selectPreset(preset);
      });
    });

    // Mode buttons
    const modeBtns = document.querySelectorAll('.btn-mode');
    modeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        modeBtns.forEach((b) => b.classList.remove('active'));
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
      });
    }

    // Velocity slider
    const velSlider = document.getElementById('slider-velocity');
    const velVal = document.getElementById('val-velocity');
    if (velSlider) {
      velSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (velVal) velVal.textContent = `${(val * 24).toFixed(0)} m/s`;
        this.solver.setInflow(val);
      });
    }

    // Reynolds / Viscosity slider
    const reSlider = document.getElementById('slider-visc');
    const reVal = document.getElementById('val-visc');
    if (reSlider) {
      reSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (reVal) reVal.textContent = val.toExponential(1);
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
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Jeda`
          : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Lanjut`;
      });
    }

    // Audio button
    const btnAudio = document.getElementById('btn-audio');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const active = this.acoustics.toggleMute();
        btnAudio.classList.toggle('audio-active', active);
        btnAudio.innerHTML = active
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Audio Nyala`
          : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg> Audio Hening`;
      });
    }

    // Reset button
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.solver.resetFlow();
      });
    }

    // Snapshot Export button
    const btnSnapshot = document.getElementById('btn-snapshot');
    if (btnSnapshot) {
      btnSnapshot.addEventListener('click', () => {
        this.exportSnapshot();
      });
    }

    // Canvas Mouse & Touch Interactivity
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

      // Check if clicking near obstacle center to drag
      const dx = pos.x - this.solver.obstacleX;
      const dy = pos.y - this.solver.obstacleY;
      if (Math.sqrt(dx * dx + dy * dy) < this.solver.chordLength * 0.7) {
        this.isDraggingObstacle = true;
        this.dragStart = { x: pos.x, y: pos.y };
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      this.isDraggingObstacle = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const pos = getGridPos(e.clientX, e.clientY);

      if (this.isMouseDown && this.solver.obstacleType === 'custom') {
        const isRightClick = e.buttons === 2;
        this.solver.paintSolidCircle(pos.x, pos.y, 4.0, !isRightClick);
      } else if (this.isDraggingObstacle) {
        this.solver.obstacleX = Math.max(10, Math.min(this.solver.nx - 40, Math.round(pos.x)));
        this.solver.obstacleY = Math.max(10, Math.min(this.solver.ny - 10, Math.round(pos.y)));
        this.solver.rebuildObstacle();
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Touch events for mobile/tablet
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
          this.solver.obstacleX = Math.max(10, Math.min(this.solver.nx - 40, Math.round(pos.x)));
          this.solver.obstacleY = Math.max(10, Math.min(this.solver.ny - 10, Math.round(pos.y)));
          this.solver.rebuildObstacle();
        }
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.isMouseDown = false;
      this.isDraggingObstacle = false;
    });

    // Keyboard Shortcuts
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
      } else if (e.key >= '1' && e.key <= '6') {
        const presets = ['naca0012', 'cambered', 'cylinder', 'f1wing', 'wedge', 'flatplate'];
        const p = presets[parseInt(e.key, 10) - 1];
        if (p) {
          const btn = document.querySelector(`[data-preset="${p}"]`);
          if (btn) btn.click();
        }
      }
    });
  }

  selectPreset(preset) {
    this.solver.obstacleType = preset;
    if (preset === 'custom') {
      // Keep canvas as is for drawing
    } else {
      this.solver.rebuildObstacle();
      this.solver.resetFlow();
    }
  }

  exportSnapshot() {
    const link = document.createElement('a');
    link.download = `aeroflow_${this.solver.obstacleType}_${Date.now()}.png`;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }

  updateUI() {
    const s = this.solver;

    // Header Quick Telemetry
    const reEl = document.getElementById('tel-re');
    if (reEl) reEl.textContent = s.reynolds.toLocaleString();

    const speedEl = document.getElementById('tel-speed');
    if (speedEl) speedEl.textContent = `${(s.inflowVelocity * 24.5).toFixed(0)} m/s`;

    const machEl = document.getElementById('tel-mach');
    if (machEl) {
      const mach = (s.inflowVelocity * 24.5) / 340.0;
      machEl.textContent = `M ${mach.toFixed(2)}`;
    }

    const stallEl = document.getElementById('tel-stall');
    if (stallEl) {
      if (s.isStalled) {
        stallEl.textContent = 'STALL DETECTED';
        stallEl.className = 'stall-badge stalled';
      } else {
        stallEl.textContent = 'LAMINAR FLOW';
        stallEl.className = 'stall-badge';
      }
    }

    // Side HUD Matrix
    const clVal = document.getElementById('hud-cl');
    if (clVal) clVal.textContent = s.cl.toFixed(3);

    const cdVal = document.getElementById('hud-cd');
    if (cdVal) cdVal.textContent = s.cd.toFixed(3);

    const ldVal = document.getElementById('hud-ld');
    if (ldVal) ldVal.textContent = s.ldRatio.toFixed(1);

    const shedVal = document.getElementById('hud-shed');
    if (shedVal) shedVal.textContent = `${s.vortexSheddingFreq.toFixed(0)} Hz`;

    const fpsEl = document.getElementById('hud-fps');
    if (fpsEl) fpsEl.textContent = `${this.fps} FPS`;

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

    // Center zero line
    const zeroY = h * 0.55;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(w, zeroY);
    ctx.stroke();

    // Plot CL (Cyan line)
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const len = this.clHistory.length;
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * w;
      const y = zeroY - this.clHistory[i] * 18;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Plot CD (Amber line)
    ctx.strokeStyle = '#ff9f1c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * w;
      const y = zeroY - this.cdHistory[i] * 18;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Legend tags
    ctx.font = '9px monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('CL', 6, 12);
    ctx.fillStyle = '#ff9f1c';
    ctx.fillText('CD', 26, 12);
  }

  loop(timestamp) {
    // Calculate FPS
    this.frameCount++;
    if (timestamp - this.fpsTimer >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / (timestamp - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = timestamp;
      this.updateUI();
    }

    if (this.isRunning) {
      // Step aerodynamic simulation
      this.solver.step();
      // Update procedural sound synthesis
      this.acoustics.update(this.solver);
    }

    // Render Canvas
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  render() {
    const s = this.solver;
    const nx = s.nx;
    const ny = s.ny;
    const data = this.imgData.data;

    // Fast pixel buffer filling based on active view mode
    if (this.viewMode === 'pressure') {
      // Bernoulli Pressure Heatmap (Blue = low pressure suction, Red = high stagnation pressure)
      for (let k = 0; k < s.size; k++) {
        const pIdx = k * 4;
        if (s.solid[k]) {
          data[pIdx] = 20;
          data[pIdx + 1] = 24;
          data[pIdx + 2] = 32;
          data[pIdx + 3] = 255;
        } else {
          const val = s.p[k] * 40.0;
          let r = 0, g = 0, b = 0;
          if (val > 0) {
            // High pressure (amber/red)
            r = Math.min(255, val * 240);
            g = Math.min(180, val * 100);
            b = 30;
          } else {
            // Low pressure (cyan/blue)
            const neg = Math.abs(val);
            b = Math.min(255, neg * 250);
            g = Math.min(220, neg * 180);
            r = 10;
          }
          data[pIdx] = r;
          data[pIdx + 1] = g;
          data[pIdx + 2] = b;
          data[pIdx + 3] = 255;
        }
      }
    } else if (this.viewMode === 'vorticity') {
      // Vorticity / Curl rotation core heatmap
      for (let k = 0; k < s.size; k++) {
        const pIdx = k * 4;
        if (s.solid[k]) {
          data[pIdx] = 20;
          data[pIdx + 1] = 24;
          data[pIdx + 2] = 32;
          data[pIdx + 3] = 255;
        } else {
          const curl = s.vort[k] * 90.0;
          let r = 8, g = 10, b = 16;
          if (curl > 0) {
            // Clockwise vortex: warm crimson/orange
            r = Math.min(255, 12 + curl * 220);
            g = Math.min(180, 10 + curl * 80);
            b = 30;
          } else {
            // Counter-clockwise vortex: electric cyan
            const neg = Math.abs(curl);
            b = Math.min(255, 20 + neg * 250);
            g = Math.min(240, 15 + neg * 200);
            r = 10;
          }
          data[pIdx] = r;
          data[pIdx + 1] = g;
          data[pIdx + 2] = b;
          data[pIdx + 3] = 255;
        }
      }
    } else if (this.viewMode === 'schlieren') {
      // Schlieren optical density gradient imaging (NASA wind tunnel shadowgraph)
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const k = i + j * nx;
          const pIdx = k * 4;
          if (s.solid[k]) {
            data[pIdx] = 16;
            data[pIdx + 1] = 20;
            data[pIdx + 2] = 26;
            data[pIdx + 3] = 255;
          } else {
            // Spatial gradient in pressure simulates refractive index light deflection
            const nextI = Math.min(nx - 1, i + 1);
            const prevI = Math.max(0, i - 1);
            const dp_dx = (s.p[nextI + j * nx] - s.p[prevI + j * nx]) * 450.0;
            const intensity = Math.max(0, Math.min(255, 128 + dp_dx));
            data[pIdx] = intensity * 0.85;
            data[pIdx + 1] = intensity * 0.95;
            data[pIdx + 2] = intensity;
            data[pIdx + 3] = 255;
          }
        }
      }
    } else {
      // Wind Tunnel Smoke / Dye Rake mode
      for (let k = 0; k < s.size; k++) {
        const pIdx = k * 4;
        if (s.solid[k]) {
          data[pIdx] = 18;
          data[pIdx + 1] = 22;
          data[pIdx + 2] = 30;
          data[pIdx + 3] = 255;
        } else {
          const smk = Math.min(1.0, s.smoke[k]);
          const baseR = 5, baseG = 8, baseB = 14;
          // Smoke glows in electric cyan
          const r = Math.min(255, baseR + smk * 40);
          const g = Math.min(255, baseG + smk * 220);
          const b = Math.min(255, baseB + smk * 255);
          data[pIdx] = r;
          data[pIdx + 1] = g;
          data[pIdx + 2] = b;
          data[pIdx + 3] = 255;
        }
      }
    }

    // Put image data into offscreen canvas and stretch to main viewport
    this.offscreenCtx.putImageData(this.imgData, 0, 0);

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.offscreenCanvas, 0, 0, cw, ch);

    // Overlay Lagrangian Tracer Smoke Filaments
    if (this.viewMode === 'smoke') {
      this.renderTracerFilaments(cw, ch);
    } else if (this.viewMode === 'vectors') {
      this.renderVelocityVectors(cw, ch);
    }

    // Render solid obstacle outline with high-contrast aerospace highlight
    this.renderObstacleOverlay(cw, ch);
  }

  renderTracerFilaments(cw, ch) {
    const ctx = this.ctx;
    const scaleX = cw / this.solver.nx;
    const scaleY = ch / this.solver.ny;

    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.7)';

    for (let k = 0; k < this.solver.tracers.length; k++) {
      const p = this.solver.tracers[k];
      const px = p.x * scaleX;
      const py = p.y * scaleY;
      const alpha = Math.max(0.1, 1.0 - (p.age / p.life));

      ctx.fillStyle = `rgba(0, 240, 255, ${alpha * 0.75})`;
      ctx.fillRect(px - 1.2, py - 1.2, 2.4, 2.4);
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

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 1.2;

    for (let j = stepY; j < s.ny - stepY; j += stepY) {
      for (let i = stepX; i < s.nx - stepX; i += stepX) {
        const idx = s.index(i, j);
        if (s.solid[idx]) continue;

        const uVal = s.u[idx];
        const vVal = s.v[idx];
        const speed = Math.sqrt(uVal * uVal + vVal * vVal);
        if (speed < 0.05) continue;

        const startX = i * scaleX;
        const startY = j * scaleY;
        const arrowLen = Math.min(24, speed * 12);
        const endX = startX + (uVal / speed) * arrowLen;
        const endY = startY + (vVal / speed) * arrowLen;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(endY - startY, endX - startX);
        ctx.beginPath();
        ctx.arc(endX, endY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  renderObstacleOverlay(cw, ch) {
    const ctx = this.ctx;
    const s = this.solver;
    const scaleX = cw / s.nx;
    const scaleY = ch / s.ny;

    // Draw aerodynamic lift & drag vector arrows at obstacle center
    const ox = s.obstacleX * scaleX;
    const oy = s.obstacleY * scaleY;

    if (s.obstacleType !== 'custom') {
      ctx.save();

      // Lift vector arrow (Green)
      const liftLen = Math.max(-60, Math.min(60, s.cl * 28));
      ctx.strokeStyle = '#00e676';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox, oy - liftLen);
      ctx.stroke();

      ctx.fillStyle = '#00e676';
      ctx.font = '10px monospace';
      ctx.fillText(`Lift (CL: ${s.cl.toFixed(2)})`, ox + 6, oy - liftLen);

      // Drag vector arrow (Orange)
      const dragLen = Math.max(10, Math.min(70, s.cd * 35));
      ctx.strokeStyle = '#ff9f1c';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + dragLen, oy);
      ctx.stroke();

      ctx.fillStyle = '#ff9f1c';
      ctx.fillText(`Drag (CD: ${s.cd.toFixed(2)})`, ox + dragLen + 6, oy + 4);

      // Center pivot point
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.aeroApp = new App();
});
