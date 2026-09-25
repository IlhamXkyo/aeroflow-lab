/**
 * AeroFlow Lab - Real-Time Eulerian Aerodynamics & Navier-Stokes Solver
 * Implements 2D incompressible Navier-Stokes equations with vorticity confinement,
 * solid boundary pressure projection, Lagrangian streakline smoke tracers,
 * and aerodynamic surface force integration (Lift & Drag).
 */

export class AerodynamicSolver {
  constructor(nx = 192, ny = 96) {
    this.nx = nx;
    this.ny = ny;
    this.size = nx * ny;
    this.h = 1.0; // grid spacing
    this.dt = 0.2; // simulation time step

    // Velocity fields
    this.u = new Float32Array(this.size);
    this.v = new Float32Array(this.size);
    this.uPrev = new Float32Array(this.size);
    this.vPrev = new Float32Array(this.size);

    // Pressure & Divergence
    this.p = new Float32Array(this.size);
    this.pPrev = new Float32Array(this.size);
    this.div = new Float32Array(this.size);

    // Vorticity field
    this.vort = new Float32Array(this.size);

    // Solid obstacle mask (1 = solid, 0 = fluid)
    this.solid = new Uint8Array(this.size);

    // Continuous smoke dye density
    this.smoke = new Float32Array(this.size);
    this.smokePrev = new Float32Array(this.size);

    // Inflow parameters
    this.inflowVelocity = 1.6;
    this.viscosity = 0.0001; // kinematic viscosity
    this.vorticityConfinement = 0.35; // vortex sharpness

    // Obstacle geometry definition
    this.obstacleType = 'naca0012';
    this.obstacleX = Math.floor(nx * 0.32);
    this.obstacleY = Math.floor(ny * 0.50);
    this.chordLength = Math.floor(nx * 0.28);
    this.angleDegrees = 6.0; // Angle of attack

    // Telemetry values
    this.liftForce = 0.0;
    this.dragForce = 0.0;
    this.cl = 0.0;
    this.cd = 0.0;
    this.ldRatio = 0.0;
    this.reynolds = 12000;
    this.isStalled = false;
    this.stallFactor = 0.0;
    this.vortexSheddingFreq = 0.0;

    // Lagrangian tracer particles (Wind tunnel smoke filaments)
    this.numRakes = 32;
    this.tracers = [];
    this.initTracers();

    // Rebuild solid geometry and initialize flow
    this.rebuildObstacle();
    this.resetFlow();
  }

  index(i, j) {
    return i + j * this.nx;
  }

  initTracers() {
    this.tracers = [];
    const numTracers = 1200;
    for (let k = 0; k < numTracers; k++) {
      const rakeIdx = k % this.numRakes;
      const yRake = (rakeIdx + 0.5) * (this.ny / this.numRakes);
      const xPos = Math.random() * this.nx;
      this.tracers.push({
        x: xPos,
        y: yRake + (Math.random() - 0.5) * 0.4,
        origY: yRake,
        age: Math.random() * 200,
        life: 200 + Math.random() * 100,
        rakeId: rakeIdx
      });
    }
  }

  rebuildObstacle() {
    this.solid.fill(0);
    const ox = this.obstacleX;
    const oy = this.obstacleY;
    const chord = this.chordLength;
    const rad = (this.angleDegrees * Math.PI) / 180.0;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    for (let j = 1; j < this.ny - 1; j++) {
      for (let i = 1; i < this.nx - 1; i++) {
        const dx = i - ox;
        const dy = j - oy;

        // Rotate to local obstacle coordinates
        const lx = dx * cosA + dy * sinA;
        const ly = -dx * sinA + dy * cosA;
        const normX = lx / chord;

        let inside = false;

        switch (this.obstacleType) {
          case 'naca0012': {
            // Symmetric NACA 0012 airfoil
            if (normX >= 0.0 && normX <= 1.0) {
              const t = 0.12;
              const yt = 5.0 * t * (
                0.2969 * Math.sqrt(normX) -
                0.1260 * normX -
                0.3516 * normX * normX +
                0.2843 * normX * normX * normX -
                0.1015 * normX * normX * normX * normX
              ) * chord;
              if (Math.abs(ly) <= yt) inside = true;
            }
            break;
          }

          case 'cambered': {
            // Cambered Airfoil (NACA 4412)
            if (normX >= 0.0 && normX <= 1.0) {
              const m = 0.04;
              const p = 0.4;
              let yc = 0;
              if (normX < p) {
                yc = (m / (p * p)) * (2 * p * normX - normX * normX);
              } else {
                yc = (m / ((1 - p) * (1 - p))) * ((1 - 2 * p) + 2 * p * normX - normX * normX);
              }
              const t = 0.12;
              const yt = 5.0 * t * (
                0.2969 * Math.sqrt(normX) -
                0.1260 * normX -
                0.3516 * normX * normX +
                0.2843 * normX * normX * normX -
                0.1015 * normX * normX * normX * normX
              );
              const camY = yc * chord;
              const halfThick = yt * chord;
              if (ly >= camY - halfThick && ly <= camY + halfThick) inside = true;
            }
            break;
          }

          case 'cylinder': {
            // Bluff circular cylinder for Von Karman vortex shedding
            const radius = chord * 0.22;
            const distSq = dx * dx + dy * dy;
            if (distSq <= radius * radius) inside = true;
            break;
          }

          case 'f1wing': {
            // Formula 1 inverted multi-element wing with Gurney flap
            if (normX >= 0.0 && normX <= 0.85) {
              const camber = -0.09 * (1.0 - Math.pow(normX - 0.4, 2));
              const thick = 0.07 * Math.sin(normX * Math.PI / 0.85);
              const localY = camber * chord;
              const halfT = thick * chord;
              if (ly >= localY - halfT && ly <= localY + halfT) inside = true;
            }
            // Vertical Gurney flap at trailing edge
            if (normX >= 0.82 && normX <= 0.88 && ly >= -0.02 * chord && ly <= 0.12 * chord) {
              inside = true;
            }
            break;
          }

          case 'wedge': {
            // Supersonic sharp diamond wedge
            if (normX >= 0.0 && normX <= 1.0) {
              const halfH = normX < 0.5 ? normX * 0.22 * chord : (1.0 - normX) * 0.22 * chord;
              if (Math.abs(ly) <= halfH) inside = true;
            }
            break;
          }

          case 'flatplate': {
            // Flat plate with high wake separation
            if (normX >= 0.0 && normX <= 0.95 && Math.abs(ly) <= chord * 0.035) {
              inside = true;
            }
            break;
          }

          case 'custom': {
            // Preserved from freehand painting
            break;
          }
        }

        if (this.obstacleType !== 'custom' && inside) {
          this.solid[this.index(i, j)] = 1;
        }
      }
    }
  }

  resetFlow() {
    this.u.fill(this.inflowVelocity);
    this.v.fill(0);
    this.p.fill(0);
    this.div.fill(0);
    this.smoke.fill(0);

    // Seed initial smoke stripes
    for (let j = 0; j < this.ny; j++) {
      const rake = Math.floor((j / this.ny) * this.numRakes);
      const isBand = (j % Math.floor(this.ny / this.numRakes)) < 2;
      for (let i = 0; i < this.nx; i++) {
        const idx = this.index(i, j);
        if (this.solid[idx]) {
          this.u[idx] = 0;
          this.v[idx] = 0;
        } else if (isBand) {
          this.smoke[idx] = 0.8;
        }
      }
    }
  }

  // Semi-Lagrangian linear bilinear interpolator
  sampleBilinear(field, x, y) {
    const x0 = Math.max(0, Math.min(this.nx - 2, Math.floor(x)));
    const y0 = Math.max(0, Math.min(this.ny - 2, Math.floor(y)));
    const s = Math.max(0, Math.min(1, x - x0));
    const t = Math.max(0, Math.min(1, y - y0));

    const i00 = this.index(x0, y0);
    const i10 = this.index(x0 + 1, y0);
    const i01 = this.index(x0, y0 + 1);
    const i11 = this.index(x0 + 1, y0 + 1);

    return (1 - s) * (1 - t) * field[i00] +
           s * (1 - t) * field[i10] +
           (1 - s) * t * field[i01] +
           s * t * field[i11];
  }

  step() {
    const nx = this.nx;
    const ny = this.ny;
    const dt = this.dt;

    // 1. Boundary condition: Inflow on left, Outflow on right
    for (let j = 0; j < ny; j++) {
      const idxLeft = this.index(0, j);
      this.u[idxLeft] = this.inflowVelocity;
      this.v[idxLeft] = 0;

      // Inject smoke pulses continuously at left boundary
      const rakeProgress = (j / ny) * this.numRakes;
      const distToRake = Math.abs(rakeProgress - Math.round(rakeProgress));
      if (distToRake < 0.18) {
        this.smoke[idxLeft] = 1.0;
      } else {
        this.smoke[idxLeft] = 0.0;
      }

      // Outflow zero gradient
      const idxRight = this.index(nx - 1, j);
      const idxRightInner = this.index(nx - 2, j);
      this.u[idxRight] = this.u[idxRightInner];
      this.v[idxRight] = this.v[idxRightInner];
      this.smoke[idxRight] = this.smoke[idxRightInner];
    }

    // Top and bottom slip boundaries
    for (let i = 0; i < nx; i++) {
      this.v[this.index(i, 0)] = 0;
      this.v[this.index(i, ny - 1)] = 0;
      this.u[this.index(i, 0)] = this.u[this.index(i, 1)];
      this.u[this.index(i, ny - 1)] = this.u[this.index(i, ny - 2)];
    }

    // Obstacle solid zero-velocity condition
    for (let k = 0; k < this.size; k++) {
      if (this.solid[k]) {
        this.u[k] = 0;
        this.v[k] = 0;
        this.smoke[k] = 0;
      }
    }

    // 2. Vorticity Confinement (Fedkiw et al.) to prevent artificial numerical dissipation
    if (this.vorticityConfinement > 0) {
      this.computeVorticity();
      this.applyVorticityConfinement();
    }

    // 3. Advection (Semi-Lagrangian method)
    this.uPrev.set(this.u);
    this.vPrev.set(this.v);
    this.smokePrev.set(this.smoke);

    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const idx = this.index(i, j);
        if (this.solid[idx]) continue;

        // Backtrack
        const backX = i - this.uPrev[idx] * dt;
        const backY = j - this.vPrev[idx] * dt;

        this.u[idx] = this.sampleBilinear(this.uPrev, backX, backY);
        this.v[idx] = this.sampleBilinear(this.vPrev, backX, backY);
        this.smoke[idx] = this.sampleBilinear(this.smokePrev, backX, backY) * 0.998;
      }
    }

    // 4. Pressure Poisson solve and Divergence Projection
    this.project();

    // 5. Update Lagrangian tracer smoke lines
    this.updateTracers();

    // 6. Integrate aerodynamic forces (Lift & Drag)
    this.calculateAeroForces();
  }

  computeVorticity() {
    const nx = this.nx;
    const ny = this.ny;
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const idx = this.index(i, j);
        if (this.solid[idx]) {
          this.vort[idx] = 0;
          continue;
        }
        // curl = dv/dx - du/dy
        const dv_dx = (this.v[this.index(i + 1, j)] - this.v[this.index(i - 1, j)]) * 0.5;
        const du_dy = (this.u[this.index(i, j + 1)] - this.u[this.index(i, j - 1)]) * 0.5;
        this.vort[idx] = dv_dx - du_dy;
      }
    }
  }

  applyVorticityConfinement() {
    const nx = this.nx;
    const ny = this.ny;
    const eps = this.vorticityConfinement * 0.18;

    for (let j = 2; j < ny - 2; j++) {
      for (let i = 2; i < nx - 2; i++) {
        const idx = this.index(i, j);
        if (this.solid[idx]) continue;

        // Gradient of absolute vorticity
        const gradX = (Math.abs(this.vort[this.index(i + 1, j)]) - Math.abs(this.vort[this.index(i - 1, j)])) * 0.5;
        const gradY = (Math.abs(this.vort[this.index(i, j + 1)]) - Math.abs(this.vort[this.index(i, j - 1)])) * 0.5;

        const mag = Math.sqrt(gradX * gradX + gradY * gradY) + 1e-6;
        const nxNorm = gradX / mag;
        const nyNorm = gradY / mag;

        const omega = this.vort[idx];
        // Confinement force: F = epsilon * h * (N x omega)
        const fx = nyNorm * omega * eps;
        const fy = -nxNorm * omega * eps;

        this.u[idx] += fx * this.dt;
        this.v[idx] += fy * this.dt;
      }
    }
  }

  project() {
    const nx = this.nx;
    const ny = this.ny;

    // Calculate Divergence
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const idx = this.index(i, j);
        if (this.solid[idx]) {
          this.div[idx] = 0;
          this.p[idx] = 0;
          continue;
        }

        let uRight = this.u[this.index(i + 1, j)];
        let uLeft = this.u[this.index(i - 1, j)];
        let vDown = this.v[this.index(i, j + 1)];
        let vUp = this.v[this.index(i, j - 1)];

        // Handle solid obstacle neighbors
        if (this.solid[this.index(i + 1, j)]) uRight = this.u[idx];
        if (this.solid[this.index(i - 1, j)]) uLeft = this.u[idx];
        if (this.solid[this.index(i, j + 1)]) vDown = this.v[idx];
        if (this.solid[this.index(i, j - 1)]) vUp = this.v[idx];

        this.div[idx] = -0.5 * (uRight - uLeft + vDown - vUp);
        this.p[idx] = 0;
      }
    }

    // Jacobi Pressure Poisson iterations
    const iterations = 22;
    for (let iter = 0; iter < iterations; iter++) {
      this.pPrev.set(this.p);

      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const idx = this.index(i, j);
          if (this.solid[idx]) continue;

          let pL = this.pPrev[this.index(i - 1, j)];
          let pR = this.pPrev[this.index(i + 1, j)];
          let pU = this.pPrev[this.index(i, j - 1)];
          let pD = this.pPrev[this.index(i, j + 1)];

          // Neumann boundary condition: zero normal pressure gradient at solid surface
          if (this.solid[this.index(i - 1, j)]) pL = this.pPrev[idx];
          if (this.solid[this.index(i + 1, j)]) pR = this.pPrev[idx];
          if (this.solid[this.index(i, j - 1)]) pU = this.pPrev[idx];
          if (this.solid[this.index(i, j + 1)]) pD = this.pPrev[idx];

          this.p[idx] = (pL + pR + pU + pD + this.div[idx]) * 0.25;
        }
      }
    }

    // Velocity update: subtract pressure gradient to achieve divergence-free field
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const idx = this.index(i, j);
        if (this.solid[idx]) continue;

        if (!this.solid[this.index(i - 1, j)] && !this.solid[this.index(i + 1, j)]) {
          this.u[idx] -= 0.5 * (this.p[this.index(i + 1, j)] - this.p[this.index(i - 1, j)]);
        }
        if (!this.solid[this.index(i, j - 1)] && !this.solid[this.index(i, j + 1)]) {
          this.v[idx] -= 0.5 * (this.p[this.index(i, j + 1)] - this.p[this.index(i, j - 1)]);
        }
      }
    }
  }

  updateTracers() {
    const dt = this.dt;
    const nx = this.nx;
    const ny = this.ny;

    for (let k = 0; k < this.tracers.length; k++) {
      const p = this.tracers[k];
      p.age += 1;

      // Sample local velocity
      const vx = this.sampleBilinear(this.u, p.x, p.y);
      const vy = this.sampleBilinear(this.v, p.x, p.y);

      // Runge-Kutta 2nd order advection for smooth particle paths
      const midX = p.x + vx * dt * 0.5;
      const midY = p.y + vy * dt * 0.5;
      const midVx = this.sampleBilinear(this.u, midX, midY);
      const midVy = this.sampleBilinear(this.v, midX, midY);

      p.x += midVx * dt;
      p.y += midVy * dt;

      // Check collision with solid obstacle
      const cellX = Math.round(p.x);
      const cellY = Math.round(p.y);
      let hitSolid = false;
      if (cellX >= 0 && cellX < nx && cellY >= 0 && cellY < ny) {
        if (this.solid[this.index(cellX, cellY)]) hitSolid = true;
      }

      // Respawn conditions
      if (p.x >= nx - 2 || p.y <= 1 || p.y >= ny - 2 || p.age >= p.life || hitSolid) {
        p.x = 1.0 + Math.random() * 2.0;
        p.y = p.origY + (Math.random() - 0.5) * 0.5;
        p.age = 0;
      }
    }
  }

  calculateAeroForces() {
    let fxTotal = 0;
    let fyTotal = 0;
    let surfaceCells = 0;
    let upperReverseFlow = 0;
    let upperTotalCells = 0;

    const ox = this.obstacleX;
    const oy = this.obstacleY;
    const chord = this.chordLength;

    // Loop over solid cells and sample surface pressure normals
    for (let j = 1; j < this.ny - 1; j++) {
      for (let i = 1; i < this.nx - 1; i++) {
        const idx = this.index(i, j);
        if (!this.solid[idx]) continue;

        // Check 4 cardinal neighbors
        const neighbors = [
          { di: 1, dj: 0, nx: 1, ny: 0 },
          { di: -1, dj: 0, nx: -1, ny: 0 },
          { di: 0, dj: 1, nx: 0, ny: 1 },
          { di: 0, dj: -1, nx: 0, ny: -1 }
        ];

        for (const n of neighbors) {
          const ni = i + n.di;
          const nj = j + n.dj;
          const nIdx = this.index(ni, nj);

          if (!this.solid[nIdx]) {
            // Fluid neighbor: surface boundary cell
            surfaceCells++;
            const pVal = this.p[nIdx];

            // Surface pressure force pushes inward on the obstacle
            fxTotal += -pVal * n.nx;
            fyTotal += -pVal * n.ny;

            // Monitor upper suction surface for reverse flow (aerodynamic stall)
            if (nj < oy && ni >= ox && ni <= ox + chord) {
              upperTotalCells++;
              if (this.u[nIdx] < 0.1) {
                upperReverseFlow++;
              }
            }
          }
        }
      }
    }

    // Dynamic pressure reference: q = 0.5 * rho * U^2
    const rho = 1.225; // kg/m^3 standard sea-level air
    const uInf = Math.max(0.1, this.inflowVelocity);
    const qDyn = 0.5 * rho * uInf * uInf;
    const refArea = (this.chordLength * 0.15);

    // Coordinate system: y increases downward on canvas, so lift is -fy
    this.liftForce = -fyTotal * 8.0;
    this.dragForce = Math.max(0.01, fxTotal * 8.0);

    // Dimensionless coefficients
    this.cl = this.liftForce / (qDyn * refArea);
    this.cd = this.dragForce / (qDyn * refArea);
    this.ldRatio = this.cd > 0.001 ? (this.cl / this.cd) : 0.0;

    // Reynolds number estimation: Re = (U * L) / nu
    this.reynolds = Math.round((uInf * this.chordLength * 40.0) / (this.viscosity * 1000 + 0.01));

    // Stall assessment based on reverse flow fraction
    if (upperTotalCells > 4) {
      this.stallFactor = upperReverseFlow / upperTotalCells;
      this.isStalled = this.stallFactor > 0.35 || Math.abs(this.angleDegrees) > 17.5;
    } else {
      this.stallFactor = 0.0;
      this.isStalled = false;
    }

    // Strouhal vortex shedding frequency for bluff bodies: f = St * U / D
    const strouhal = 0.21;
    const diameter = this.chordLength * 0.44;
    this.vortexSheddingFreq = (strouhal * uInf * 150.0) / (diameter + 0.1);
  }

  setAngle(deg) {
    this.angleDegrees = Math.max(-30, Math.min(30, deg));
    if (this.obstacleType !== 'custom') {
      this.rebuildObstacle();
    }
  }

  setInflow(val) {
    this.inflowVelocity = Math.max(0.2, Math.min(3.5, val));
  }

  setViscosity(val) {
    this.viscosity = Math.max(0.00001, Math.min(0.002, val));
  }

  setVorticityConfinement(val) {
    this.vorticityConfinement = Math.max(0.0, Math.min(0.9, val));
  }

  paintSolidCircle(x, y, radius, isSolid = true) {
    const rSq = radius * radius;
    const minI = Math.max(1, Math.floor(x - radius));
    const maxI = Math.min(this.nx - 2, Math.ceil(x + radius));
    const minJ = Math.max(1, Math.floor(y - radius));
    const maxJ = Math.min(this.ny - 2, Math.ceil(y + radius));

    for (let j = minJ; j <= maxJ; j++) {
      for (let i = minI; i <= maxI; i++) {
        const dx = i - x;
        const dy = j - y;
        if (dx * dx + dy * dy <= rSq) {
          const idx = this.index(i, j);
          this.solid[idx] = isSolid ? 1 : 0;
          if (isSolid) {
            this.u[idx] = 0;
            this.v[idx] = 0;
          }
        }
      }
    }
    this.obstacleType = 'custom';
  }

  clearSolid() {
    this.solid.fill(0);
    this.obstacleType = 'custom';
  }
}
